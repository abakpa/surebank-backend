const Customer = require('../../Customer/Model/index');
const Account = require('../../Account/Model/index');
const SBAccount = require('../../SBAccount/Model/index');
const Branch = require('../../Branch/Model/index');
const AccountTransactionModel = require('../../AccountTransaction/Model/index');
const AccountTransactionService = require('../../AccountTransaction/Service/index');
const PaystackService = require('../../Paystack/Service/index');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const getDefaultBranch = async () => {
  // Get the first branch as default for e-commerce customers
  // You can configure a specific "E-Commerce" branch if needed
  const branch = await Branch.findOne({});
  if (!branch) {
    throw new Error('No branch configured. Please create a branch first.');
  }
  return branch;
};

const checkExistingCustomer = async (phone) => {
  return await Customer.findOne({ phone });
};

const formatTransactionDate = (date = new Date()) => {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getReportingStaffId = (accountManagerId, fallbackActor) => {
  if (accountManagerId && accountManagerId !== 'ECOMMERCE_SYSTEM') {
    return accountManagerId;
  }

  return fallbackActor;
};

const ensureCustomerAccount = async (customer) => {
  const customerId = customer._id.toString();
  let account = await Account.findOne({ customerId });

  if (!account) {
    account = await Account.findOne({ accountNumber: customer.phone });
  }

  if (!account) {
    const branchId = customer.branchId || (await getDefaultBranch())._id.toString();
    account = await Account.create({
      customerId,
      accountNumber: customer.phone,
      createdBy: 'ECOMMERCE_SYSTEM',
      branchId,
      accountManagerId: customer.accountManagerId || '',
      status: 'active',
      availableBalance: 0,
      ledgerBalance: 0
    });
  }

  if (account.accountNumber !== customer.phone) {
    account.accountNumber = customer.phone;
    await account.save();
  }

  return account;
};

const getWalletTransactions = async (accountId) => {
  return await AccountTransactionModel.find({
    accountTypeId: accountId.toString(),
    package: 'Wallet'
  }).sort({ createdAt: -1 }).limit(20);
};

const registerEcommerceCustomer = async (customerData) => {
  const { firstName, lastName, phone, address, password, email } = customerData;

  // Check if customer already exists
  const existingCustomer = await checkExistingCustomer(phone);
  if (existingCustomer) {
    throw new Error('Phone number already registered. Please login instead.');
  }

  // Get default branch for e-commerce customers
  const defaultBranch = await getDefaultBranch();

  // Hash password
  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create customer
  const customer = new Customer({
    firstName,
    lastName,
    phone,
    email,
    address,
    password: hashedPassword,
    createdBy: 'ECOMMERCE_SYSTEM',
    branchId: defaultBranch._id.toString(),
    accountManagerId: ''
  });

  const newCustomer = await customer.save();

  // Create main account (ledger)
  const account = new Account({
    customerId: newCustomer._id.toString(),
    accountNumber: phone,
    createdBy: 'ECOMMERCE_SYSTEM',
    branchId: defaultBranch._id.toString(),
    accountManagerId: '',
    status: 'active',
    availableBalance: 0,
    ledgerBalance: 0
  });

  await account.save();

  // Generate token
  const token = jwt.sign(
    { id: newCustomer._id, phone: newCustomer.phone },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '24h' }
  );

  return {
    customer: {
      id: newCustomer._id,
      firstName: newCustomer.firstName,
      lastName: newCustomer.lastName,
      phone: newCustomer.phone,
      email: newCustomer.email,
      address: newCustomer.address
    },
    accountNumber: phone,
    SBAccountNumber: null,
    token
  };
};

const loginEcommerceCustomer = async (phone, password) => {
  const customer = await Customer.findOne({ phone });
  if (!customer) {
    throw new Error('Invalid phone number or password');
  }

  const isMatch = await bcrypt.compare(password, customer.password);
  if (!isMatch) {
    throw new Error('Invalid phone number or password');
  }

  // Generate token
  const token = jwt.sign(
    { id: customer._id, phone: customer.phone },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '24h' }
  );

  return {
    customer: {
      id: customer._id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email,
      address: customer.address
    },
    accountNumber: customer.phone,
    SBAccountNumber: null,
    token
  };
};

const getCustomerProfile = async (customerId) => {
  const customer = await Customer.findById(customerId).select('-password');
  if (!customer) {
    throw new Error('Customer not found');
  }

  const account = await ensureCustomerAccount(customer);
  const sbAccounts = await SBAccount.find({ customerId: customerId.toString() });

  return {
    customer,
    account,
    sbAccounts
  };
};

const updateCustomerProfile = async (customerId, updateData) => {
  const { firstName, lastName, address, email } = updateData;

  const customer = await Customer.findByIdAndUpdate(
    customerId,
    { $set: { firstName, lastName, address, email } },
    { new: true }
  ).select('-password');

  if (!customer) {
    throw new Error('Customer not found');
  }

  return customer;
};

const getCustomerWallet = async (customerId) => {
  const customer = await Customer.findById(customerId).select('-password');
  if (!customer) {
    throw new Error('Customer not found');
  }

  const account = await ensureCustomerAccount(customer);
  const transactions = await getWalletTransactions(account._id);

  return {
    customer: {
      id: customer._id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address
    },
    account,
    transactions
  };
};

const initializeWalletFunding = async (customerId, fundingData) => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const account = await ensureCustomerAccount(customer);
  const amount = Number(fundingData.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Please provide a valid amount');
  }

  const customerEmail = (fundingData.customerEmail || customer.email || '').trim();
  if (!customerEmail || !customerEmail.includes('@')) {
    throw new Error('A valid email address is required');
  }

  const callbackUrl = fundingData.callbackUrl;
  if (!callbackUrl) {
    throw new Error('Callback URL is required');
  }

  const reference = PaystackService.generateReference('WAL');
  const paymentResult = await PaystackService.initializeTransaction({
    email: customerEmail,
    amount: Math.round(amount * 100),
    reference,
    callback_url: callbackUrl,
    channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
    metadata: {
      wallet_data: {
        fundingType: 'wallet',
        customerId: customer._id.toString(),
        accountId: account._id.toString(),
        accountNumber: customer.phone,
        amount
      }
    }
  });

  if (!paymentResult || !paymentResult.data || !paymentResult.data.authorization_url) {
    throw new Error('Failed to get payment URL from Paystack');
  }

  return {
    authorization_url: paymentResult.data.authorization_url,
    access_code: paymentResult.data.access_code,
    reference,
    amount
  };
};

const verifyWalletFunding = async (customerId, reference) => {
  const verificationResult = await PaystackService.verifyTransaction(reference);

  if (verificationResult.data.status !== 'success') {
    throw new Error('Payment not successful');
  }

  const walletData = verificationResult.data.metadata?.wallet_data;
  if (!walletData || walletData.fundingType !== 'wallet') {
    throw new Error('Invalid wallet payment metadata');
  }

  if (walletData.customerId !== customerId.toString()) {
    throw new Error('This wallet payment does not belong to the current customer');
  }

  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const account = await ensureCustomerAccount(customer);
  const narration = `Wallet Funding - Ref: ${reference}`;
  const existingTransaction = await AccountTransactionModel.findOne({
    accountTypeId: account._id.toString(),
    narration
  });

  if (existingTransaction) {
    const refreshedAccount = await Account.findById(account._id);
    const transactions = await getWalletTransactions(account._id);
    return {
      account: refreshedAccount,
      transaction: existingTransaction,
      transactions,
      alreadyProcessed: true,
      paymentDetails: {
        amount: existingTransaction.amount,
        reference,
        paidAt: verificationResult.data.paid_at
      }
    };
  }

  const amount = Number(walletData.amount || (verificationResult.data.amount / 100));
  const newAvailableBalance = Number(account.availableBalance || 0) + amount;
  const newLedgerBalance = Number(account.ledgerBalance || 0) + amount;
  const reportingActor = getReportingStaffId(
    account.accountManagerId || customer.accountManagerId,
    customer._id.toString()
  );

  await AccountTransactionService.DepositTransactionAccount({
    createdBy: reportingActor,
    transactionOwnerId: customer._id.toString(),
    customerId: customer._id.toString(),
    amount,
    balance: newAvailableBalance,
    branchId: account.branchId || customer.branchId,
    accountManagerId: account.accountManagerId || 'ECOMMERCE_SYSTEM',
    accountNumber: customer.phone,
    accountTypeId: account._id.toString(),
    date: formatTransactionDate(),
    narration,
    package: 'Wallet',
    direction: 'Credit',
  });

  const updatedAccount = await Account.findByIdAndUpdate(
    account._id,
    {
      $set: {
        accountNumber: customer.phone,
        availableBalance: newAvailableBalance,
        ledgerBalance: newLedgerBalance,
        status: 'active'
      }
    },
    { new: true }
  );

  if (customer.email !== verificationResult.data.customer?.email) {
    customer.email = verificationResult.data.customer?.email || customer.email;
    await customer.save();
  }

  const transactions = await getWalletTransactions(account._id);
  const transaction = transactions[0] || null;

  return {
    account: updatedAccount,
    transaction,
    transactions,
    alreadyProcessed: false,
    paymentDetails: {
      amount,
      reference,
      paidAt: verificationResult.data.paid_at
    }
  };
};

const changePassword = async (customerId, currentPassword, newPassword) => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const isMatch = await bcrypt.compare(currentPassword, customer.password);
  if (!isMatch) {
    throw new Error('Current password is incorrect');
  }

  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  customer.password = hashedPassword;
  await customer.save();

  return { message: 'Password changed successfully' };
};

module.exports = {
  checkExistingCustomer,
  registerEcommerceCustomer,
  loginEcommerceCustomer,
  getCustomerProfile,
  updateCustomerProfile,
  changePassword,
  getCustomerWallet,
  initializeWalletFunding,
  verifyWalletFunding
};
