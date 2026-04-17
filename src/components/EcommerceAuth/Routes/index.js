const express = require('express');
const router = express.Router();
const EcommerceAuthController = require('../Controller/index');
const { customerAuth } = require('../../Middleware/index');

// Public routes
router.post('/register', EcommerceAuthController.register);
router.post('/login', EcommerceAuthController.login);
router.get('/check-phone', EcommerceAuthController.checkPhone);

// Protected routes
router.get('/profile', customerAuth, EcommerceAuthController.getProfile);
router.put('/profile', customerAuth, EcommerceAuthController.updateProfile);
router.put('/change-password', customerAuth, EcommerceAuthController.changePassword);
router.get('/wallet', customerAuth, EcommerceAuthController.getWallet);
router.post('/wallet/fund/initialize', customerAuth, EcommerceAuthController.initializeWalletFunding);
router.get('/wallet/fund/verify/:reference', customerAuth, EcommerceAuthController.verifyWalletFunding);

module.exports = router;
