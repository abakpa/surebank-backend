const ReferralService = require('../Service');

const getAdminSummary = async (req, res) => {
  try {
    const result = await ReferralService.getReferralAdminSummary(null, req.query);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const result = await ReferralService.updateReferralSettings({
      incentivePercentage: req.body.incentivePercentage,
      enabled: req.body.enabled,
      loginBonusEnabled: req.body.loginBonusEnabled,
      loginBonusAmount: req.body.loginBonusAmount,
      transactionBonusEnabled: req.body.transactionBonusEnabled,
      transactionBonusPercentage: req.body.transactionBonusPercentage,
      rootCustomerIds: req.body.rootCustomerIds || [],
      staffId: req.staff.staffId,
    });
    res.status(200).json({
      message: 'Referral settings updated successfully',
      ...result,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const searchCustomers = async (req, res) => {
  try {
    const customers = await ReferralService.searchCustomers(req.query.search || '');
    res.status(200).json({ customers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCustomerSummary = async (req, res) => {
  try {
    const result = await ReferralService.getCustomerReferralSummary(req.customer.customerId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const transferCustomerIncentiveToWallet = async (req, res) => {
  try {
    const result = await ReferralService.transferReferralIncentiveToWallet(
      req.customer.customerId,
      req.body.amount
    );
    res.status(200).json({
      message: 'Referral incentive transferred to wallet successfully',
      ...result,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const transferCustomerLoginBonusToWallet = async (req, res) => {
  try {
    const result = await ReferralService.transferLoginBonusToWallet(
      req.customer.customerId,
      req.body.amount
    );
    res.status(200).json({
      message: 'Login bonus transferred to wallet successfully',
      ...result,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const transferCustomerTransactionBonusToWallet = async (req, res) => {
  try {
    const result = await ReferralService.transferTransactionBonusToWallet(
      req.customer.customerId,
      req.body.amount
    );
    res.status(200).json({
      message: 'Transaction bonus transferred to wallet successfully',
      ...result,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const creditPaidOrder = async (req, res) => {
  try {
    const result = await ReferralService.creditPaidOrderByNumber(req.body.orderNumber);
    res.status(200).json({
      message: result.credited
        ? 'Referral incentive credited successfully'
        : `Referral incentive not credited: ${result.reason || 'not eligible'}`,
      result,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAdminSummary,
  updateSettings,
  searchCustomers,
  getCustomerSummary,
  transferCustomerIncentiveToWallet,
  transferCustomerLoginBonusToWallet,
  transferCustomerTransactionBonusToWallet,
  creditPaidOrder,
};
