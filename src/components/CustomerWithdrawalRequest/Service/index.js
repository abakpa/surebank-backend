const CustomerWithdrawalRequestModel = require('../Model/index');
const Account = require('../../Account/Model/index');
const AccountTransaction = require('../../AccountTransaction/Model/index');
const Branch = require('../../Branch/Model/index');
const Customer = require('../../Customer/Model/index');
const Staff = require('../../Staff/Model/index');
const DSAccount = require('../../DSAccount/Model/index');
const mongoose = require('mongoose');

const formatTransactionDate = (date = new Date()) => {
    return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
};

const CustomerWithdrawalRequest = async (withdrawalData) => {
  const requestData = { ...withdrawalData };
  const hasRequestBankDetails = Boolean(
    String(requestData.bankName || '').trim()
    && String(requestData.accountName || '').trim()
    && String(requestData.bankAccountNumber || '').trim()
  );

  if (!hasRequestBankDetails && requestData.customerId) {
    const settlementBankDetails = await getCustomerSettlementBankDetails(requestData.customerId);
    Object.assign(requestData, settlementBankDetails);
  }

  await assertNoActiveWithdrawalRequest({
    customerId: requestData.customerId,
    accountTypeId: requestData.accountTypeId,
    packageNumber: requestData.packageNumber,
  });

  const withdrawalRequest = new CustomerWithdrawalRequestModel(requestData);
  return await withdrawalRequest.save();
};

function normalizeSettlementBankDetails(details = {}) {
    return {
    bankName: String(details.bankName || '').trim(),
    accountName: String(details.accountName || '').trim(),
    bankAccountNumber: String(details.bankAccountNumber || '').trim(),
    };
}

const hasSettlementBankDetails = (details = {}) => {
    const normalized = normalizeSettlementBankDetails(details);
    return Boolean(normalized.bankName && normalized.accountName && normalized.bankAccountNumber);
};

const getCustomerSettlementBankDetails = async (customerId) => {
    const customer = await Customer.findById(customerId).select('settlementBankDetails').lean();
    if (!customer) {
        throw new Error('Customer not found');
    }

    const settlementBankDetails = normalizeSettlementBankDetails(customer.settlementBankDetails || {});
    if (!hasSettlementBankDetails(settlementBankDetails)) {
        throw new Error('Settlement bank details are required before making a withdrawal request');
    }

    return settlementBankDetails;
};

const resolveAndSaveCustomerSettlementBankDetails = async (customerId, details = {}) => {
    const requestBankDetails = normalizeSettlementBankDetails(details);

    if (hasSettlementBankDetails(requestBankDetails)) {
        await Customer.findByIdAndUpdate(customerId, {
            $set: {
                settlementBankDetails: requestBankDetails,
            },
        });
        return requestBankDetails;
    }

    return getCustomerSettlementBankDetails(customerId);
};

const assertNoActiveWithdrawalRequest = async ({ customerId, accountTypeId, packageNumber }) => {
    const activeRequest = await CustomerWithdrawalRequestModel.findOne({
        customerId,
        accountTypeId,
        status: { $in: ['Pending', 'pending', 'Processing', 'processing'] },
    }).lean();

    if (activeRequest) {
        const requestLabel = packageNumber || activeRequest.packageNumber || 'this account/package';
        throw new Error(`There is already a pending withdrawal request for ${requestLabel}. Wait for admin to complete or reject it before making another request.`);
    }
};

const createStaffCustomerWithdrawalRequest = async (withdrawalData, staff = {}) => {
    const amount = Number(withdrawalData.amount || 0);
    if (!amount || amount <= 0) {
        throw new Error('Invalid withdrawal request amount');
    }

    const requestType = String(withdrawalData.requestType || '').toLowerCase();
    const isFreeToWithdrawRequest = requestType === 'free_to_withdraw' || /free\s*to\s*withdraw/i.test(withdrawalData.package || '');

    if (isFreeToWithdrawRequest) {
        const settlementBankDetails = await resolveAndSaveCustomerSettlementBankDetails(withdrawalData.customerId, withdrawalData);
        const account = await Account.findOne({
            _id: withdrawalData.accountTypeId,
            customerId: withdrawalData.customerId,
        });

        if (!account) {
            throw new Error('Customer account not found for this request');
        }

        if (amount > Number(account.availableBalance || 0)) {
            throw new Error(`Insufficient available balance. Available: ₦${Number(account.availableBalance || 0).toLocaleString()}, Requested: ₦${amount.toLocaleString()}`);
        }

        await assertNoActiveWithdrawalRequest({
            customerId: account.customerId,
            accountTypeId: account._id.toString(),
            packageNumber: account.accountNumber,
        });

        return CustomerWithdrawalRequest({
            accountNumber: account.accountNumber,
            customerId: account.customerId,
            accountManagerId: account.accountManagerId || staff.staffId,
            accountTypeId: account._id.toString(),
            packageNumber: account.accountNumber,
            branchId: account.branchId,
            package: 'Free To Withdraw',
            channelOfWithdrawal: 'Free To Withdraw Request',
            date: new Date(),
            amount,
            ...settlementBankDetails,
        });
    }

    const settlementBankDetails = await resolveAndSaveCustomerSettlementBankDetails(withdrawalData.customerId, withdrawalData);
    const dsaccount = await DSAccount.findOne({
        _id: withdrawalData.accountTypeId,
        customerId: withdrawalData.customerId,
    });

    if (!dsaccount) {
        throw new Error('Customer does not have an active DS package');
    }

    if (dsaccount.status === 'closed') {
        throw new Error('This account has been closed');
    }

    if (amount > Number(dsaccount.totalContribution || 0)) {
        throw new Error(`Insufficient DS package balance. Available: ₦${Number(dsaccount.totalContribution || 0).toLocaleString()}, Requested: ₦${amount.toLocaleString()}`);
    }

    await assertNoActiveWithdrawalRequest({
        customerId: dsaccount.customerId,
        accountTypeId: dsaccount._id.toString(),
        packageNumber: dsaccount.DSAccountNumber,
    });

    return CustomerWithdrawalRequest({
        accountNumber: dsaccount.accountNumber,
        customerId: dsaccount.customerId,
        accountManagerId: dsaccount.accountManagerId || staff.staffId,
        accountTypeId: dsaccount._id.toString(),
        packageNumber: dsaccount.DSAccountNumber,
        branchId: dsaccount.branchId,
        package: 'DS',
        channelOfWithdrawal: 'DS Package Withdrawal Request',
        date: new Date(),
        amount,
        ...settlementBankDetails,
    });
};

const statusOrder = {
    pending: 1,
    processing: 2,
    completed: 3,
};

const sortRequestsByStatus = (requests) => requests.sort((a, b) => {
    const statusA = (a.status || '').toLowerCase();
    const statusB = (b.status || '').toLowerCase();
    return (statusOrder[statusA] || 99) - (statusOrder[statusB] || 99);
});

const isValidObjectId = (value) => Boolean(value) && mongoose.Types.ObjectId.isValid(String(value));

const enrichWithdrawalRequests = async (requests) => {
    const plainRequests = requests.map((request) => (
        typeof request.toObject === 'function' ? request.toObject() : request
    ));

    const customerIds = [...new Set(plainRequests.map((request) => request.customerId).filter(isValidObjectId).map(String))];
    const branchIds = [...new Set(plainRequests.map((request) => request.branchId).filter(isValidObjectId).map(String))];
    const staffIds = [...new Set(plainRequests.map((request) => request.accountManagerId).filter(isValidObjectId).map(String))];

    const [customers, branches, staffList] = await Promise.all([
        customerIds.length ? Customer.find({ _id: { $in: customerIds } }).lean() : [],
        branchIds.length ? Branch.find({ _id: { $in: branchIds } }).lean() : [],
        staffIds.length ? Staff.find({ _id: { $in: staffIds } }).lean() : [],
    ]);

    const customerMap = new Map(customers.map((customer) => [customer._id.toString(), customer]));
    const branchMap = new Map(branches.map((branch) => [branch._id.toString(), branch]));
    const staffMap = new Map(staffList.map((staff) => [staff._id.toString(), staff]));

    return sortRequestsByStatus(plainRequests.map((request) => {
        const accountManagerId = String(request.accountManagerId || '');
        const staff = staffMap.get(accountManagerId);

        return {
            ...request,
            customerId: customerMap.get(String(request.customerId)) || request.customerId,
            branchId: branchMap.get(String(request.branchId)) || request.branchId,
            accountManagerId: staff || {
                _id: accountManagerId || 'ECOMMERCE_SYSTEM',
                firstName: accountManagerId === 'ECOMMERCE_SYSTEM' || !accountManagerId ? 'Ecommerce' : 'N/A',
                lastName: '',
            },
        };
    }));
};

const getCustomersWithdrawalRequest = async () => {
    try {
        const requests = await CustomerWithdrawalRequestModel.find({}).lean();
        return enrichWithdrawalRequests(requests);
    } catch (error) {
        throw error;
    }
}
const getBranchCustomersWithdrawalRequest = async (branchId) => {
    try {
        const requests = await CustomerWithdrawalRequestModel.find({branchId:branchId}).lean();
        return enrichWithdrawalRequests(requests);
    } catch (error) {
        throw error;
    }
}
const getRepCustomersWithdrawalRequest = async (repId) => {
    try {
        const requests = await CustomerWithdrawalRequestModel.find({accountManagerId:repId}).lean();
        return enrichWithdrawalRequests(requests);
    } catch (error) {
        throw error;
    }
}
const getCustomersWithdrawalRequestForCustomer = async (customerId) => {
    try {
        const requests = await CustomerWithdrawalRequestModel.find({customerId:customerId}).lean();
        return enrichWithdrawalRequests(requests);
    } catch (error) {
        throw error;
    }
}
  const updateCustomerWithdrawalRequestStatus = async (details) => {
    const { withdrawalRequestId, adminId, staff } = details;
    try {
        // First find the current request
        const currentRequest = await CustomerWithdrawalRequestModel.findById({ _id:withdrawalRequestId });
        
        if (!currentRequest) {
            throw new Error('Withdrawal request not found');
        }

        if (staff?.role === 'Manager' && String(currentRequest.branchId || '') !== String(staff.branchId || '')) {
            throw new Error('You are not allowed to process this withdrawal request');
        }

        let newStatus;
        
        // Determine the new status based on current status
        const currentStatus = (currentRequest.status || '').toLowerCase();

        if (currentStatus === 'pending') {
            newStatus = 'processing';
        } else if (currentStatus === 'processing') {
            const amount = Number(currentRequest.amount || 0);
            const shouldDebitAvailableBalance = /free\s*to\s*withdraw/i.test(currentRequest.package || '');
            const shouldDebitDSPackage = String(currentRequest.package || '').toLowerCase() === 'ds';

            if (shouldDebitAvailableBalance) {
                const account = await Account.findOne({
                    _id: currentRequest.accountTypeId,
                    customerId: currentRequest.customerId,
                });

                if (!account) {
                    throw new Error('Customer account not found for this request');
                }

                const availableBalance = Number(account.availableBalance || 0);
                if (amount <= 0) {
                    throw new Error('Invalid withdrawal request amount');
                }

                if (amount > availableBalance) {
                    throw new Error(`Insufficient available balance. Available: ₦${availableBalance.toLocaleString()}, Requested: ₦${amount.toLocaleString()}`);
                }

                const newAvailableBalance = availableBalance - amount;

                await AccountTransaction.create({
                    accountNumber: account.accountNumber,
                    customerId: currentRequest.customerId,
                    amount,
                    balance: newAvailableBalance,
                    createdBy: adminId,
                    transactionOwnerId: adminId,
                    narration: 'Withdrawal',
                    accountTypeId: account._id.toString(),
                    accountManagerId: account.accountManagerId || currentRequest.accountManagerId,
                    branchId: account.branchId || currentRequest.branchId,
                    date: formatTransactionDate(),
                    package: 'Account',
                    direction: 'Debit',
                });

                await Account.findByIdAndUpdate(account._id, {
                    $set: {
                        availableBalance: newAvailableBalance,
                        ledgerBalance: Number(account.ledgerBalance || 0) - amount,
                    },
                });
            }

            if (shouldDebitDSPackage) {
                const dsaccount = await DSAccount.findOne({
                    _id: currentRequest.accountTypeId,
                    customerId: currentRequest.customerId,
                });

                if (!dsaccount) {
                    throw new Error('Customer DS package not found for this request');
                }

                if (dsaccount.status === 'closed') {
                    throw new Error('This account has been closed');
                }

                if (amount <= 0) {
                    throw new Error('Invalid withdrawal request amount');
                }

                if (amount > Number(dsaccount.totalContribution || 0)) {
                    throw new Error(`Insufficient DS package balance. Available: ₦${Number(dsaccount.totalContribution || 0).toLocaleString()}, Requested: ₦${amount.toLocaleString()}`);
                }

                const account = await Account.findOne({ accountNumber: dsaccount.accountNumber });
                if (!account) {
                    throw new Error('Account not found for ledger update');
                }

                const newBalance = Number(dsaccount.totalContribution || 0) - amount;

                await AccountTransaction.create({
                    accountNumber: dsaccount.accountNumber,
                    customerId: currentRequest.customerId,
                    amount,
                    balance: newBalance,
                    createdBy: adminId,
                    transactionOwnerId: adminId,
                    narration: 'DS package withdrawal request paid',
                    accountTypeId: dsaccount._id.toString(),
                    accountManagerId: dsaccount.accountManagerId || currentRequest.accountManagerId,
                    branchId: dsaccount.branchId || currentRequest.branchId,
                    date: formatTransactionDate(),
                    package: 'DS',
                    direction: 'Debit',
                });

                if (newBalance > 0) {
                    await AccountTransaction.create({
                        accountNumber: dsaccount.accountNumber,
                        customerId: currentRequest.customerId,
                        amount: newBalance,
                        balance: 0,
                        createdBy: adminId,
                        transactionOwnerId: adminId,
                        narration: 'Moved',
                        accountTypeId: dsaccount._id.toString(),
                        accountManagerId: dsaccount.accountManagerId || currentRequest.accountManagerId,
                        branchId: dsaccount.branchId || currentRequest.branchId,
                        date: formatTransactionDate(),
                        package: 'DS',
                        direction: 'Moved',
                    });

                    await AccountTransaction.create({
                        accountNumber: account.accountNumber,
                        customerId: currentRequest.customerId,
                        amount: newBalance,
                        balance: Number(account.availableBalance || 0) + newBalance,
                        createdBy: adminId,
                        transactionOwnerId: adminId,
                        narration: 'From DS account',
                        accountTypeId: account._id.toString(),
                        accountManagerId: account.accountManagerId || currentRequest.accountManagerId,
                        branchId: account.branchId || currentRequest.branchId,
                        date: formatTransactionDate(),
                        package: 'DS',
                        direction: 'Transfer',
                    });
                }

                await Account.findByIdAndUpdate(account._id, {
                    $set: {
                        availableBalance: Number(account.availableBalance || 0) + newBalance,
                        ledgerBalance: Number(account.ledgerBalance || 0) - amount,
                    },
                });

                await DSAccount.findByIdAndUpdate(dsaccount._id, {
                    $set: {
                        hasBeenCharged: 'false',
                        totalContribution: 0,
                        totalCount: 0,
                    },
                });
            }

            newStatus = 'completed';
        } else {
            throw new Error(`Cannot update from current status: ${currentRequest.status}`);
        }

        // Update the status
        const updatedWithdrawalRequest = await CustomerWithdrawalRequestModel.findOneAndUpdate(
            { _id:withdrawalRequestId },
            { $set: { status: newStatus } },
            { new: true }
        );

        return { 
            success: true, 
            message: 'Status updated successfully', 
            updatedWithdrawalRequest 
        };
    } catch (error) {
        throw new Error(`${error.message}`);
    }
};

module.exports = {
    CustomerWithdrawalRequest,
    createStaffCustomerWithdrawalRequest,
    getCustomersWithdrawalRequest,
    updateCustomerWithdrawalRequestStatus,
    getBranchCustomersWithdrawalRequest,
    getCustomersWithdrawalRequestForCustomer,
    getRepCustomersWithdrawalRequest

  };
