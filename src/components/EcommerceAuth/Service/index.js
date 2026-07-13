const Customer = require('../../Customer/Model/index');
const Account = require('../../Account/Model/index');
const SBAccount = require('../../SBAccount/Model/index');
const Branch = require('../../Branch/Model/index');
const AccountTransactionModel = require('../../AccountTransaction/Model/index');
const AccountTransactionService = require('../../AccountTransaction/Service/index');
const PaystackService = require('../../Paystack/Service/index');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const getDefaultBranch = async () => {
  const branch = await Branch.findOne({
    branchKey: 'hq',
    isActive: { $ne: false }
  }) || await Branch.findOne({
    name: { $regex: /^hq$/i },
    isActive: { $ne: false }
  }) || await Branch.findOne({
    name: { $regex: /^head\s*office$/i },
    isActive: { $ne: false }
  }) || await Branch.findOne({
    isActive: { $ne: false }
  });

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

const buildFallbackEmail = (customer) => {
  const identifier = String(customer?.phone || customer?._id || 'customer')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  return `${identifier || 'customer'}@surebankstores.com`;
};

const buildSBOrderWalletAccountNumber = (customer) => `${customer.phone}-SBW`;

const ensureCustomerAccount = async (customer) => {
  const customerId = customer._id.toString();
  let account = await Account.findOne({
    customerId,
    walletType: { $ne: 'sb_order_wallet' }
  });

  if (!account) {
    account = await Account.findOne({
      accountNumber: customer.phone,
      walletType: { $ne: 'sb_order_wallet' }
    });
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

const ensureCustomerSBOrderWallet = async (customer) => {
  const customerId = customer._id.toString();
  const accountNumber = buildSBOrderWalletAccountNumber(customer);
  let account = await Account.findOne({
    customerId,
    walletType: 'sb_order_wallet'
  });

  if (!account) {
    account = await Account.findOne({
      accountNumber,
      walletType: 'sb_order_wallet'
    });
  }

  if (!account) {
    const branchId = customer.branchId || (await getDefaultBranch())._id.toString();
    account = await Account.create({
      customerId,
      accountNumber,
      walletType: 'sb_order_wallet',
      createdBy: 'ECOMMERCE_SYSTEM',
      branchId,
      accountManagerId: customer.accountManagerId || '',
      status: 'active',
      availableBalance: 0,
      ledgerBalance: 0
    });
  }

  const updates = {};
  if (account.accountNumber !== accountNumber) {
    updates.accountNumber = accountNumber;
  }
  if (account.walletType !== 'sb_order_wallet') {
    updates.walletType = 'sb_order_wallet';
  }
  if (Object.keys(updates).length > 0) {
    account = await Account.findByIdAndUpdate(account._id, { $set: updates }, { new: true });
  }

  return account;
};

const getWalletTransactions = async (accountId, customerId = '') => {
  const transactionQueries = [{
    accountTypeId: accountId.toString(),
    package: 'Wallet'
  }];

  if (customerId) {
    const ecommerceSBAccounts = await SBAccount.find({
      customerId: customerId.toString(),
      createdBy: 'ECOMMERCE_SYSTEM'
    }).select('_id').lean();
    const ecommerceSBAccountIds = ecommerceSBAccounts.map((account) => account._id.toString());

    if (ecommerceSBAccountIds.length > 0) {
      transactionQueries.push({
        accountTypeId: { $in: ecommerceSBAccountIds },
        package: 'SB',
        direction: { $in: ['Debit', 'Purchased'] },
        narration: { $not: /^Reversed payment reservation for changed product:/i }
      });
    }
  }

  return await AccountTransactionModel.find({
    $or: transactionQueries
  }).sort({ createdAt: -1 }).limit(50);
};

const registerEcommerceCustomer = async (customerData) => {
  const { firstName, lastName, phone, address, password, email } = customerData;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  // Check if customer already exists
  const existingCustomer = await checkExistingCustomer(phone);
  if (existingCustomer) {
    throw new Error('Phone number already registered. Please login instead.');
  }
  if (normalizedEmail) {
    const existingEmailCustomer = await Customer.findOne({ email: normalizedEmail });
    if (existingEmailCustomer) {
      throw new Error('Email address is already used by another customer');
    }
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
    email: normalizedEmail,
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

  if (customer.updatePassword !== 'false') {
    return {
      customer: {
        id: customer._id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        requiresPasswordUpdate: true
      },
      accountNumber: customer.phone,
      SBAccountNumber: null,
      requiresPasswordUpdate: true
    };
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
      address: customer.address,
      requiresPasswordUpdate: customer.updatePassword !== 'false'
    },
    accountNumber: customer.phone,
    SBAccountNumber: null,
    token,
    requiresPasswordUpdate: customer.updatePassword !== 'false'
  };
};

const getCustomerProfile = async (customerId) => {
  const customer = await Customer.findById(customerId).select('-password');
  if (!customer) {
    throw new Error('Customer not found');
  }

  const account = await ensureCustomerSBOrderWallet(customer);
  const sbAccounts = await SBAccount.find({ customerId: customerId.toString() });

  return {
    customer,
    account,
    sbAccounts
  };
};

const updateCustomerProfile = async (customerId, updateData) => {
  const { firstName, lastName, address, email } = updateData;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail && !normalizedEmail.includes('@')) {
    throw new Error('Enter a valid email address');
  }

  if (normalizedEmail) {
    const existingEmailCustomer = await Customer.findOne({
      email: normalizedEmail,
      _id: { $ne: customerId }
    });
    if (existingEmailCustomer) {
      throw new Error('Email address is already used by another customer');
    }
  }

  const customer = await Customer.findByIdAndUpdate(
    customerId,
    { $set: { firstName, lastName, address, email: normalizedEmail } },
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

  const account = await ensureCustomerSBOrderWallet(customer);
  const transactions = await getWalletTransactions(account._id, customer._id);

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

  const account = await ensureCustomerSBOrderWallet(customer);
  const amount = Number(fundingData.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Please provide a valid amount');
  }

  const providedEmail = (fundingData.customerEmail || customer.email || '').trim();
  const customerEmail = providedEmail && providedEmail.includes('@')
    ? providedEmail
    : buildFallbackEmail(customer);

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
        accountNumber: account.accountNumber,
        amount,
        autoPayOrderNumber: fundingData.autoPayOrderNumber || '',
        autoPayItemId: fundingData.autoPayItemId || ''
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

  const account = await ensureCustomerSBOrderWallet(customer);
  const narration = `SB Order Wallet Funding - Ref: ${reference}`;
  const legacyNarration = `Wallet Funding - Ref: ${reference}`;
  const existingTransaction = await AccountTransactionModel.findOne({
    accountTypeId: account._id.toString(),
    narration: { $in: [narration, legacyNarration] }
  });

  if (existingTransaction) {
    let autoPaidOrder = null;
    let autoPayError = null;
    if (walletData.autoPayOrderNumber && walletData.autoPayItemId) {
      try {
        const EcommerceOrderService = require('../../EcommerceOrder/Service/index');
        autoPaidOrder = await EcommerceOrderService.payOrderItemFromWallet({
          orderNumber: walletData.autoPayOrderNumber,
          itemId: walletData.autoPayItemId,
          customerId
        });
      } catch (error) {
        autoPayError = error.message;
      }
    }

    const refreshedAccount = await Account.findById(account._id);
    const transactions = await getWalletTransactions(account._id, customer._id);
    return {
      account: refreshedAccount,
      transaction: existingTransaction,
      transactions,
      autoPaidOrder,
      autoPayError,
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
    accountNumber: account.accountNumber,
    accountTypeId: account._id.toString(),
    date: formatTransactionDate(),
    narration,
    package: 'Wallet',
    direction: 'Credit',
  });

  let updatedAccount = await Account.findByIdAndUpdate(
    account._id,
    {
      $set: {
        accountNumber: account.accountNumber,
        availableBalance: newAvailableBalance,
        ledgerBalance: newLedgerBalance,
        walletType: 'sb_order_wallet',
        status: 'active'
      }
    },
    { new: true }
  );

  if (customer.email !== verificationResult.data.customer?.email) {
    customer.email = verificationResult.data.customer?.email || customer.email;
    await customer.save();
  }

  let autoPaidOrder = null;
  let autoPayError = null;
  if (walletData.autoPayOrderNumber && walletData.autoPayItemId) {
    try {
      const EcommerceOrderService = require('../../EcommerceOrder/Service/index');
      autoPaidOrder = await EcommerceOrderService.payOrderItemFromWallet({
        orderNumber: walletData.autoPayOrderNumber,
        itemId: walletData.autoPayItemId,
        customerId
      });
      updatedAccount = await Account.findById(account._id);
    } catch (error) {
      autoPayError = error.message;
    }
  }

  const transactions = await getWalletTransactions(account._id, customer._id);
  const transaction = transactions[0] || null;

  return {
    account: updatedAccount,
    transaction,
    transactions,
    autoPaidOrder,
    autoPayError,
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
  customer.updatePassword = 'false';
  await customer.save();

  return { message: 'Password changed successfully' };
};

const createMailTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error('Email is not configured. Set SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS.');
  }

  if (host) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: { user, pass }
  });
};

const sendPasswordResetOtp = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Enter a valid email address');
  }

  const customer = await Customer.findOne({ email: normalizedEmail });
  if (!customer) {
    throw new Error('No ecommerce account found with this email');
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  customer.passwordResetOtp = await bcrypt.hash(otp, await bcrypt.genSalt());
  customer.passwordResetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  customer.passwordResetOtpAttempts = 0;
  await customer.save();

  const transporter = createMailTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.EMAIL_USER || process.env.SMTP_USER,
    to: normalizedEmail,
    subject: 'Sure-Bank Stores password reset OTP',
    text: `Your Sure-Bank Stores password reset OTP is ${otp}. It expires in 10 minutes.`,
    html: `<p>Your Sure-Bank Stores password reset OTP is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`
  });

  return { message: 'Password reset OTP sent to your email' };
};

const resetPasswordWithOtp = async ({ email, otp, newPassword }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !otp || !newPassword) {
    throw new Error('Email, OTP, and new password are required');
  }
  if (String(newPassword).length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const customer = await Customer.findOne({ email: normalizedEmail }).select('+passwordResetOtp +passwordResetOtpExpiresAt +passwordResetOtpAttempts');
  if (!customer || !customer.passwordResetOtp || !customer.passwordResetOtpExpiresAt) {
    throw new Error('Invalid or expired OTP');
  }
  if (customer.passwordResetOtpExpiresAt < new Date()) {
    throw new Error('OTP has expired');
  }
  if (Number(customer.passwordResetOtpAttempts || 0) >= 5) {
    throw new Error('Too many OTP attempts. Request a new OTP.');
  }

  const isValidOtp = await bcrypt.compare(String(otp), customer.passwordResetOtp);
  if (!isValidOtp) {
    customer.passwordResetOtpAttempts = Number(customer.passwordResetOtpAttempts || 0) + 1;
    await customer.save();
    throw new Error('Invalid OTP');
  }

  customer.password = await bcrypt.hash(newPassword, await bcrypt.genSalt());
  customer.updatePassword = 'false';
  customer.passwordResetOtp = undefined;
  customer.passwordResetOtpExpiresAt = undefined;
  customer.passwordResetOtpAttempts = 0;
  await customer.save();

  return { message: 'Password reset successfully. You can now login.' };
};

const resetAdminForcedPassword = async ({ phone, newPassword }) => {
  const normalizedPhone = String(phone || '').trim();
  if (!normalizedPhone || !newPassword) {
    throw new Error('Phone number and new password are required');
  }
  if (String(newPassword).length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const customer = await Customer.findOne({ phone: normalizedPhone });
  if (!customer) {
    throw new Error('Customer not found');
  }
  if (customer.updatePassword === 'false') {
    throw new Error('Password reset is not required for this account');
  }

  customer.password = await bcrypt.hash(newPassword, await bcrypt.genSalt());
  customer.updatePassword = 'false';
  customer.passwordResetOtp = undefined;
  customer.passwordResetOtpExpiresAt = undefined;
  customer.passwordResetOtpAttempts = 0;
  await customer.save();

  return { message: 'Password reset successfully. You can now login.' };
};

module.exports = {
  checkExistingCustomer,
  registerEcommerceCustomer,
  loginEcommerceCustomer,
  getCustomerProfile,
  updateCustomerProfile,
  changePassword,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
  resetAdminForcedPassword,
  getCustomerWallet,
  initializeWalletFunding,
  verifyWalletFunding
};
