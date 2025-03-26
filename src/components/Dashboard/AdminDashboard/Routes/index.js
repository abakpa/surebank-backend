const express = require('express');
const router = express.Router();
const AcountTransactionController = require('../Controller/index');
// const {staffAuth} = require('../../Middleware/index')

// router.post('/', staffAuth, customerController.registerCustomer);
router.get('/ds', AcountTransactionController.getAllDSAccount);
router.post('/dswithdrawal', AcountTransactionController.getAllDSAccountWithdrawal);
router.get('/dscharge', AcountTransactionController.getAllDSAccountCharge);
router.post('/dailyds', AcountTransactionController.getAllDailyDSAccount);
router.post('/dailydswithdrawal', AcountTransactionController.getAllDailyDSAccountWithdrawal);
router.get('/dailydscharge', AcountTransactionController.getAllDailyDSAccountCharge);
router.get('/sb', AcountTransactionController.getAllSBAccount);
router.post('/sbwithdrawal', AcountTransactionController.getAllSBAccountWithdrawal);
router.post('/dailysb', AcountTransactionController.getAllDailySBAccount);
router.get('/dailysbwithdrawal', AcountTransactionController.getAllDailySBAccountWithdrawal);
router.get('/totalsbandds', AcountTransactionController.getAllContribution);
router.post('/totaldailysbandds', AcountTransactionController.getAllDailyContribution);
router.post('/dspackage', AcountTransactionController.getAllDSAccountPackage);
router.post('/sbpackage', AcountTransactionController.getAllSBAccountPackage);
router.post('/packages', AcountTransactionController.getAllAccountPackage);
router.post('/sbincome', AcountTransactionController.getSBAccountIncome);
router.post('/dsincome', AcountTransactionController.getDSAccountIncome);
router.post('/totalincome', AcountTransactionController.getAllSBandDSIncome);
router.post('/totalexpenditure', AcountTransactionController.getAllExpenditure);
router.post('/profit', AcountTransactionController.getProfit);


module.exports = router;
