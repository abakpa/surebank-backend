const express = require('express');
const router = express.Router();
const AcountTransactionController = require('../Controller/index');
const {staffAuth} = require('../../../Middleware/index')

// router.post('/', staffAuth, customerController.registerCustomer);
router.post('/branchds',staffAuth, AcountTransactionController.getAllBranchDSAccount);
router.post('/branchsb',staffAuth, AcountTransactionController.getAllBranchSBAccount);
router.post('/totalsbandds',staffAuth, AcountTransactionController.getAllBranchContribution);
router.post('/dailybranchds', staffAuth,AcountTransactionController.getAllBranchDailyDSAccount);
router.post('/dailybranchfd', staffAuth,AcountTransactionController.getAllBranchDailyFDAccount);
router.post('/dailybranchsb',staffAuth, AcountTransactionController.getAllBranchDailySBAccount);
router.post('/totaldailybranchcontribution',staffAuth, AcountTransactionController.getAllBranchDailyContribution);
router.post('/dailybranchdswithdrawal',staffAuth, AcountTransactionController.getAllBranchDailyDSAccountWithdrawal);
router.post('/branchdspackage',staffAuth, AcountTransactionController.getAllBranchDSAccountPackage);
router.post('/branchsbpackage',staffAuth, AcountTransactionController.getAllBranchSBAccountPackage);
router.post('/branchpackages',staffAuth, AcountTransactionController.getAllBranchAccountPackage);
router.post('/branchsbincome',staffAuth, AcountTransactionController.getBranchSBAccountIncome);
router.post('/branchdsincome',staffAuth, AcountTransactionController.getBranchDSAccountIncome);
router.post('/branchtotalincome',staffAuth, AcountTransactionController.getBranchAllSBandDSIncome);
router.post('/branchtotalexpenditure',staffAuth, AcountTransactionController.getBranchAllExpenditure);
router.post('/branchprofit',staffAuth, AcountTransactionController.getBranchProfit);
router.post('/branchsbincomereport',staffAuth, AcountTransactionController.getBranchSBIncomeReport);
router.post('/branchdsincomereport',staffAuth, AcountTransactionController.getBranchDSIncomeReport);
router.post('/branchexpenditurereport',staffAuth, AcountTransactionController.getBranchExpenditureReport);
router.post('/branchtransaction', staffAuth, AcountTransactionController.getTransaction);
router.post('/branchorder', staffAuth, AcountTransactionController.getBranchOrder);
router.post('/branchfd', staffAuth, AcountTransactionController.getAllFDAccount);
router.post('/branchfdreport', staffAuth, AcountTransactionController.getAllFDTransaction);
router.post('/branchfdinterestincome', staffAuth, AcountTransactionController.getAllFDInterestIncome);
router.post('/branchfdinterestexpense', staffAuth, AcountTransactionController.getAllFDInterestExpense);
router.post('/branchfdpackage', staffAuth, AcountTransactionController.getAllFDPackage);


module.exports = router