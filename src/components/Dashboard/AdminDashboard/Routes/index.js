const express = require('express');
const router = express.Router();
const AcountTransactionController = require('../Controller/index');
// const {staffAuth} = require('../../Middleware/index')

// router.post('/', staffAuth, customerController.registerCustomer);
router.get('/ds', AcountTransactionController.getAllDSAccount);
router.get('/dswithdrawal', AcountTransactionController.getAllDSAccountWithdrawal);
router.get('/dscharge', AcountTransactionController.getAllDSAccountCharge);
router.get('/dailyds', AcountTransactionController.getAllDailyDSAccount);
router.get('/dailydswithdrawal', AcountTransactionController.getAllDailyDSAccountWithdrawal);
router.get('/dailydscharge', AcountTransactionController.getAllDailyDSAccountCharge);
router.get('/sb', AcountTransactionController.getAllSBAccount);
router.get('/sbwithdrawal', AcountTransactionController.getAllSBAccountWithdrawal);
router.get('/dailysb', AcountTransactionController.getAllDailySBAccount);
router.get('/dailysbwithdrawal', AcountTransactionController.getAllDailySBAccountWithdrawal);
router.get('/totalsbandds', AcountTransactionController.getAllContribution);
router.get('/totaldailysbandds', AcountTransactionController.getAllDailyContribution);
router.get('/dspackage', AcountTransactionController.getAllDSAccountPackage);
router.get('/sbpackage', AcountTransactionController.getAllSBAccountPackage);
router.get('/packages', AcountTransactionController.getAllAccountPackage);
router.get('/sbincome', AcountTransactionController.getSBAccountIncome);
router.get('/dsincome', AcountTransactionController.getDSAccountIncome);
router.get('/totalincome', AcountTransactionController.getAllSBandDSIncome);


module.exports = router;
