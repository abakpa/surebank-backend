const EcommerceAuthService = require('../Service/index');

const register = async (req, res) => {
  try {
    const { firstName, lastName, phone, address, password, email } = req.body;

    if (!firstName || !lastName || !phone || !address || !password) {
      return res.status(400).json({
        message: 'All fields are required: firstName, lastName, phone, address, password'
      });
    }

    const result = await EcommerceAuthService.registerEcommerceCustomer({
      firstName,
      lastName,
      phone,
      address,
      password,
      email
    });

    res.status(201).json({
      message: 'Registration successful',
      ...result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        message: 'Phone and password are required'
      });
    }

    const result = await EcommerceAuthService.loginEcommerceCustomer(phone, password);

    res.status(200).json({
      message: 'Login successful',
      ...result
    });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

const checkPhone = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const existingCustomer = await EcommerceAuthService.checkExistingCustomer(phone);

    res.status(200).json({
      exists: !!existingCustomer,
      message: existingCustomer
        ? 'Account exists. Please login.'
        : 'Phone number is available.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const profile = await EcommerceAuthService.getCustomerProfile(customerId);
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const { firstName, lastName, address, email } = req.body;

    const customer = await EcommerceAuthService.updateCustomerProfile(customerId, {
      firstName,
      lastName,
      address,
      email
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      customer
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getWallet = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const wallet = await EcommerceAuthService.getCustomerWallet(customerId);
    res.status(200).json(wallet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createDSAccount = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const { accountType, amountPerDay, bankName, accountName, bankAccountNumber } = req.body;

    const result = await EcommerceAuthService.createCustomerDSAccount(customerId, {
      accountType,
      amountPerDay,
      bankName,
      accountName,
      bankAccountNumber,
    });

    res.status(201).json({
      message: result.message || 'DS package created successfully',
      ...result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createFreeToWithdrawRequest = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const { amount, bankName, accountName, bankAccountNumber } = req.body;

    const result = await EcommerceAuthService.createFreeToWithdrawRequest(customerId, {
      amount,
      bankName,
      accountName,
      bankAccountNumber,
    });

    res.status(201).json({
      message: result.message || 'Withdrawal request sent successfully',
      ...result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const initializeWalletFunding = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const { amount, customerEmail, callbackUrl, autoPayOrderNumber, autoPayItemId } = req.body;

    const result = await EcommerceAuthService.initializeWalletFunding(customerId, {
      amount,
      customerEmail,
      callbackUrl,
      autoPayOrderNumber,
      autoPayItemId
    });

    res.status(200).json({
      message: 'Wallet funding initialized',
      data: result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const initializeDSAccountFunding = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const { amount, customerEmail, callbackUrl, dsAccountId } = req.body;

    const result = await EcommerceAuthService.initializeDSAccountFunding(customerId, {
      amount,
      customerEmail,
      callbackUrl,
      dsAccountId
    });

    res.status(200).json({
      message: 'DS package funding initialized',
      data: result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyWalletFunding = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const { reference } = req.params;
    const result = await EcommerceAuthService.verifyWalletFunding(customerId, reference);

    res.status(200).json({
      message: result.alreadyProcessed
        ? 'Wallet funding already processed'
        : 'Wallet funded successfully',
      ...result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const customerId = req.customer.customerId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Current password and new password are required'
      });
    }

    const result = await EcommerceAuthService.changePassword(
      customerId,
      currentPassword,
      newPassword
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await EcommerceAuthService.sendPasswordResetOtp(email);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const result = await EcommerceAuthService.resetPasswordWithOtp(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const resetAdminForcedPassword = async (req, res) => {
  try {
    const result = await EcommerceAuthService.resetAdminForcedPassword(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  checkPhone,
  forgotPassword,
  resetPassword,
  resetAdminForcedPassword,
  getProfile,
  updateProfile,
  changePassword,
  getWallet,
  createDSAccount,
  createFreeToWithdrawRequest,
  initializeWalletFunding,
  initializeDSAccountFunding,
  verifyWalletFunding
};
