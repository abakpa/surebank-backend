const express = require('express');
const router = express.Router();
const AcountTransactionController = require('../Controller/index');
const {staffAuth} = require('../../../Middleware/index')

// router.post('/', staffAuth, customerController.registerCustomer);
router.post('/ds',staffAuth, AcountTransactionController.getAllDSAccount);
router.post('/dswithdrawal',staffAuth, AcountTransactionController.getAllDSAccountWithdrawal);
router.get('/dscharge',staffAuth, AcountTransactionController.getAllDSAccountCharge);
router.post('/dailyds',staffAuth, AcountTransactionController.getAllDailyDSAccount);
router.post('/dailyfd',staffAuth, AcountTransactionController.getAllDailyFDAccount);
router.post('/dailydswithdrawal',staffAuth, AcountTransactionController.getAllDailyDSAccountWithdrawal);
router.get('/dailydscharge',staffAuth, AcountTransactionController.getAllDailyDSAccountCharge);
router.post('/sb',staffAuth, AcountTransactionController.getAllSBAccount);
router.post('/fd',staffAuth, AcountTransactionController.getAllFDAccount);
router.post('/fdreport',staffAuth, AcountTransactionController.getAllFDTransaction);
router.post('/fdinterestincome',staffAuth, AcountTransactionController.getAllFDInterestIncome);
router.post('/fdinterestexpense',staffAuth, AcountTransactionController.getAllFDInterestExpense);
router.post('/sbwithdrawal',staffAuth, AcountTransactionController.getAllSBAccountWithdrawal);
router.post('/dailysb',staffAuth, AcountTransactionController.getAllDailySBAccount);
router.get('/dailysbwithdrawal',staffAuth, AcountTransactionController.getAllDailySBAccountWithdrawal);
router.post('/totalsbandds',staffAuth, AcountTransactionController.getAllContribution);
router.post('/totaldailysbandds',staffAuth, AcountTransactionController.getAllDailyContribution);
router.post('/dspackage',staffAuth, AcountTransactionController.getAllDSAccountPackage);
router.post('/sbpackage',staffAuth, AcountTransactionController.getAllSBAccountPackage);
router.post('/fdpackage',staffAuth, AcountTransactionController.getAllFDPackage);
router.post('/packages',staffAuth, AcountTransactionController.getAllAccountPackage);
router.post('/sbincome',staffAuth, AcountTransactionController.getSBAccountIncome);
router.post('/dsincome',staffAuth, AcountTransactionController.getDSAccountIncome);
router.post('/fdincome',staffAuth, AcountTransactionController.getFDAccountIncome);
router.post('/totalincome',staffAuth, AcountTransactionController.getAllSBandDSIncome);
router.post('/totalexpenditure',staffAuth, AcountTransactionController.getAllExpenditure);
router.post('/profit',staffAuth, AcountTransactionController.getProfit);
router.post('/sbincomereport',staffAuth, AcountTransactionController.getSBIncomeReport);
router.post('/dsincomereport',staffAuth, AcountTransactionController.getDSIncomeReport);
router.post('/expenditurereport',staffAuth, AcountTransactionController.getExpenditureReport);
router.post('/transaction', staffAuth, AcountTransactionController.getTransaction);
router.post('/order', staffAuth, AcountTransactionController.getOrder);


module.exports = router;
