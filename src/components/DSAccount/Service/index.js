const Account = require('../../Account/Model');
const  generateUniqueAccountNumber  = require('../../generateAccountNumber');
const DSAccount = require('../Model/index');
const AccountTransaction = require('../../AccountTransaction/Service/index');
const SureBankAccount = require('../../SureBankAccount/Service/index')

const createDSAccount = async (DSAccountData) => {
          const existingDSAccountNumber = await getAccountByAccountNumber(DSAccountData.accountNumber);
          if (!existingDSAccountNumber) {
            return ({ message: 'Account number does not exists' });
          }
          const existingDSAccount = await DSAccount.findOne({
            accountNumber: DSAccountData.accountNumber,
            accountType: DSAccountData.accountType,
});
          if (existingDSAccount) {
            return ({ message: `Customer has an active ${DSAccountData.accountType} DS account running` });
          }
          const DSAccountNumber = await generateUniqueAccountNumber('DSA')
  const dsaccount = new DSAccount({...DSAccountData,customerId:existingDSAccountNumber.customerId,branchId:existingDSAccountNumber.branchId,DSAccountNumber});
  const newDSAccount = await dsaccount.save();
  return ({message:"Account created successfilly", newDSAccount})
};
const updateDSAccountAmount = async (details) => {
  const {DSAccountNumber,amountPerDay} = details
  try {
    // Validate input
    if (!DSAccountNumber || !amountPerDay || typeof amountPerDay !== 'number' || amountPerDay <= 0) {
      return { success: false, message: 'Invalid account number or amount' };
    }

    const dsaccount = await DSAccount.findOne({
      DSAccountNumber: DSAccountNumber,
      // accountType: contributionInput.accountType,
    });
    if (dsaccount.totalContribution !==0 && dsaccount.totalCount !==0) {
      return { success: false, message: 'You cannot edit amount while package is running' };
    }
    // Find and update the DSAccount by DSAccount
    const updatedDSAccount = await DSAccount.findOneAndUpdate(
      { DSAccountNumber }, // Find the account by accountNumber
      { $set: { amountPerDay: amountPerDay } }, // Update only the amount field
      { new: true } // Return the updated document
    );

    // Check if the account was found and updated
    if (!updatedDSAccount) {
      return { success: false, message: 'DSAccount not found or update failed' };
    }

    return { success: true, message: 'Amount updated successfully', updatedDSAccount };
  } catch (error) {
    console.error('Error updating DSAccount amount:', error);
    return { success: false, message: 'An error occurred while updating the amount', error };
  }
};
const getAccountByAccountNumber = async (accountNumber) => {
    return await Account.findOne({ accountNumber });
  };

const getDSAccounts = async () =>{
    try {
        return await DSAccount.find({});
    } catch (error) {
        throw error;
    }
  }
const getCustomerDSAccountById = async (customerId) =>{
    try {
        return await DSAccount.find({customerId:customerId});
    } catch (error) {
        throw error;
    }
  }

  const saveDailyContribution = async (contributionInput) => {
    // Retrieve customer account using the DS account number
    const customerAccount = await getDSAccountByAccountNumber(contributionInput.DSAccountNumber);
    if (!customerAccount) {
      return 'Account number does not exist.';
    }
  
    // Check for an active package with the given account type
    const dsaccount = await DSAccount.findOne({
      DSAccountNumber: contributionInput.DSAccountNumber,
      accountType: contributionInput.accountType,
    });
  
    if (!dsaccount) {
      return 'Customer does not have an active package';
    }
  
    // Validate contribution amount against the daily savings package
    if (contributionInput.amountPerDay % dsaccount.amountPerDay !== 0) {
      return `Amount is not valid for ${dsaccount.amountPerDay} daily savings package`;
    }
  
    const DSAccountId = dsaccount._id;
    const contributionDaysCount = contributionInput.amountPerDay / dsaccount.amountPerDay;
    const currentDate = new Date().getTime();
    const formattedDate = new Date(currentDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  
    if (contributionInput.amountPerDay < dsaccount.amountPerDay) {
      return `Amount cannot be less than ${dsaccount.amountPerDay}`;
    }
  
    if (dsaccount.status === 'closed') {
      return 'This account has been closed';
    }
  
    // Calculate the new total count
    const totalCount = dsaccount.totalCount + contributionDaysCount;
    if (totalCount > 31) {
      return 'Total daily amount contribution cannot exceed 31';
    }
  
    // Retrieve and update ledger balance
    const updateLedgerBalance = await Account.findOne({ accountNumber: dsaccount.accountNumber });
  
    if (!updateLedgerBalance) {
      return 'Account not found for ledger update';
    }

    if (totalCount === 31) {
      const chargeAmount = dsaccount.amountPerDay;

      await AccountTransaction.DepositTransactionAccount({
       createdBy: contributionInput.createdBy,
       amount: contributionInput.amountPerDay,
       balance: dsaccount.totalContribution + contributionInput.amountPerDay,
       branchId: dsaccount.branchId,
       accountManagerId: dsaccount.accountManagerId,
       accountNumber: dsaccount.accountNumber,
       accountTypeId: DSAccountId,
       date: formattedDate,
       narration: "Daily contribution",
       direction: "Credit",
     });
      const finalContribution = await AccountTransaction.DepositTransactionAccount({
        accountNumber: dsaccount.accountNumber,
        amount: dsaccount.totalContribution + contributionInput.amountPerDay,
        balance: 0,
        createdBy: dsaccount.createdBy,
        narration: "Total contribution",
        accountTypeId: DSAccountId,
        accountManagerId: dsaccount.accountManagerId,
        branchId: dsaccount.branchId,
        date: formattedDate,
        direction: "Debit",
      });
  
      await Account.findOneAndUpdate(
        { accountNumber: dsaccount.accountNumber },
        {
          $set: {
            availableBalance: updateLedgerBalance.availableBalance + dsaccount.totalContribution + contributionInput.amountPerDay,
            ledgerBalance: updateLedgerBalance.ledgerBalance + contributionInput.amountPerDay,
          },
        }
      );
  
      // Close the package and reset contribution data
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        hasBeenCharged: 'false',
        totalContribution: 0,
        totalCount: 0,
      });
  
      return { finalContribution };
    }
  
    if (dsaccount.hasBeenCharged === 'true') {
      await Account.findOneAndUpdate(
        { accountNumber: dsaccount.accountNumber },
        {
          $set: {
            ledgerBalance: updateLedgerBalance.ledgerBalance + contributionInput.amountPerDay,
          },
        }
      );
  
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        totalContribution: dsaccount.totalContribution + contributionInput.amountPerDay,
      });
  
      const newContribution = await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: contributionInput.amountPerDay,
        balance: dsaccount.totalContribution + contributionInput.amountPerDay,
        branchId: dsaccount.branchId,
        accountManagerId: dsaccount.accountManagerId,
        accountNumber: dsaccount.accountNumber,
        accountTypeId: DSAccountId,
        date: formattedDate,
        narration: "Daily contribution",
        direction: "Credit",
      });
      // Update total contribution count
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        $set: { totalCount },
      });
  
      return { newContribution };
    }
  
    if (dsaccount.hasBeenCharged === 'false') {
      const chargeAmount = dsaccount.amountPerDay;

       await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: contributionInput.amountPerDay,
        balance: dsaccount.totalContribution + contributionInput.amountPerDay,
        branchId: dsaccount.branchId,
        accountManagerId: dsaccount.accountManagerId,
        accountNumber: dsaccount.accountNumber,
        accountTypeId: DSAccountId,
        date: formattedDate,
        narration: "Daily contribution",
        direction: "Credit",
      });
  
      // Log the charge as a new contribution
      const newContribution = await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: chargeAmount,
        balance: contributionInput.amountPerDay - chargeAmount,
        branchId: dsaccount.branchId,
        accountManagerId: dsaccount.accountManagerId,
        accountNumber: dsaccount.accountNumber,
        accountTypeId: DSAccountId,
        date: formattedDate,
        narration: "Contribution Charge",
        direction: "Debit",
      });
      const newBalance = contributionInput.amountPerDay - chargeAmount
  
      await Account.findOneAndUpdate(
        { accountNumber: dsaccount.accountNumber },
        {
          $set: {
            ledgerBalance: updateLedgerBalance.ledgerBalance + newBalance,
          },
        }
      );
  
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        hasBeenCharged: "true",
        totalContribution: contributionInput.amountPerDay - chargeAmount,
      });
      // Update total contribution count
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        $set: { totalCount },
      });
  
      return { newContribution };
    }
 
  
   
  
    return { message: "Contribution processed successfully" };
  };
  

  const getDSAccountByAccountNumber = async (DSAccountNumber) => {
    return await DSAccount.findOne({ DSAccountNumber:DSAccountNumber });
  };

  module.exports = {
    createDSAccount,
    getDSAccountByAccountNumber,
    getDSAccounts,
    saveDailyContribution,
    getCustomerDSAccountById,
    updateDSAccountAmount
  };