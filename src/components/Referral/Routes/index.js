const express = require('express');
const router = express.Router();
const ReferralController = require('../Controller');
const { staffAuth, customerAuth, adminOnly } = require('../../Middleware');

router.get('/me', customerAuth, ReferralController.getCustomerSummary);
router.post('/me/transfer-to-wallet', customerAuth, ReferralController.transferCustomerIncentiveToWallet);
router.post('/me/login-bonus/transfer-to-wallet', customerAuth, ReferralController.transferCustomerLoginBonusToWallet);
router.post('/me/transaction-bonus/transfer-to-wallet', customerAuth, ReferralController.transferCustomerTransactionBonusToWallet);
router.get('/admin', staffAuth, ReferralController.getAdminSummary);
router.get('/admin/customers', staffAuth, ReferralController.searchCustomers);
router.put('/admin/settings', staffAuth, adminOnly, ReferralController.updateSettings);
router.post('/admin/credit-paid-order', staffAuth, adminOnly, ReferralController.creditPaidOrder);

module.exports = router;
