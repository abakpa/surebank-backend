const express = require('express');
const router = express.Router();
const AcountTransactionController = require('../Controller/index');
const {staffAuth} = require('../../../Middleware/index')

// router.post('/', staffAuth, customerController.registerCustomer);
router.post('/ds', AcountTransactionController.getAllDSAccount);
router.post('/dswithdrawal', AcountTransactionController.getAllDSAccountWithdrawal);
router.get('/dscharge', AcountTransactionController.getAllDSAccountCharge);
router.post('/dailyds', AcountTransactionController.getAllDailyDSAccount);
router.post('/dailydswithdrawal', AcountTransactionController.getAllDailyDSAccountWithdrawal);
router.get('/dailydscharge', AcountTransactionController.getAllDailyDSAccountCharge);
router.post('/sb', AcountTransactionController.getAllSBAccount);
router.post('/fd', AcountTransactionController.getAllFDAccount);
router.post('/fdreport', AcountTransactionController.getAllFDTransaction);
router.post('/fdinterestincome', AcountTransactionController.getAllFDInterestIncome);
router.post('/fdinterestexpense', AcountTransactionController.getAllFDInterestExpense);
router.post('/sbwithdrawal', AcountTransactionController.getAllSBAccountWithdrawal);
router.post('/dailysb', AcountTransactionController.getAllDailySBAccount);
router.get('/dailysbwithdrawal', AcountTransactionController.getAllDailySBAccountWithdrawal);
router.post('/totalsbandds', AcountTransactionController.getAllContribution);
router.post('/totaldailysbandds', AcountTransactionController.getAllDailyContribution);
router.post('/dspackage', AcountTransactionController.getAllDSAccountPackage);
router.post('/sbpackage', AcountTransactionController.getAllSBAccountPackage);
router.post('/fdpackage', AcountTransactionController.getAllFDPackage);
router.post('/packages', AcountTransactionController.getAllAccountPackage);
router.post('/sbincome', AcountTransactionController.getSBAccountIncome);
router.post('/dsincome', AcountTransactionController.getDSAccountIncome);
router.post('/totalincome', AcountTransactionController.getAllSBandDSIncome);
router.post('/totalexpenditure', AcountTransactionController.getAllExpenditure);
router.post('/profit', AcountTransactionController.getProfit);
router.post('/sbincomereport', AcountTransactionController.getSBIncomeReport);
router.post('/dsincomereport', AcountTransactionController.getDSIncomeReport);
router.post('/expenditurereport', AcountTransactionController.getExpenditureReport);
router.post('/transaction', staffAuth, AcountTransactionController.getTransaction);
router.post('/order', staffAuth, AcountTransactionController.getOrder);


module.exports = router;
