const express = require('express');
const router = express.Router();
const AcountTransactionController = require('../Controller/index');
const {staffAuth} = require('../../../Middleware/index')

// router.post('/', staffAuth, customerController.registerCustomer);
router.post('/repds',staffAuth, AcountTransactionController.getAllRepDSAccount);
router.post('/repsb',staffAuth, AcountTransactionController.getAllRepSBAccount);
router.post('/totalsbandds',staffAuth, AcountTransactionController.getAllRepContribution);
router.post('/dailyrepds', staffAuth,AcountTransactionController.getAllRepDailyDSAccount);
router.post('/dailyrepfd', staffAuth,AcountTransactionController.getAllRepDailyFDAccount);
router.post('/dailyrepsb',staffAuth, AcountTransactionController.getAllRepDailySBAccount);
router.post('/totaldailyrepcontribution',staffAuth, AcountTransactionController.getAllRepDailyContribution);
router.post('/dailyrepdswithdrawal',staffAuth, AcountTransactionController.getAllRepDailyDSAccountWithdrawal);
router.post('/repdspackage',staffAuth, AcountTransactionController.getAllRepDSAccountPackage);
router.post('/repsbpackage',staffAuth, AcountTransactionController.getAllRepSBAccountPackage);
router.post('/reppackages',staffAuth, AcountTransactionController.getAllRepAccountPackage);
router.post('/repsbincome',staffAuth, AcountTransactionController.getRepSBAccountIncome);
router.post('/repdsincome',staffAuth, AcountTransactionController.getRepDSAccountIncome);
router.post('/reptotalincome',staffAuth, AcountTransactionController.getRepAllSBandDSIncome);
router.post('/reptotalexpenditure',staffAuth, AcountTransactionController.getRepAllExpenditure);
router.post('/repprofit',staffAuth, AcountTransactionController.getRepProfit);
router.post('/repsbincomereport',staffAuth, AcountTransactionController.getRepSBIncomeReport);
router.post('/repdsincomereport',staffAuth, AcountTransactionController.getRepDSIncomeReport);
router.post('/repexpenditurereport',staffAuth, AcountTransactionController.getRepExpenditureReport);
router.post('/reptransaction', staffAuth, AcountTransactionController.getTransaction);
router.post('/reporder', staffAuth, AcountTransactionController.getRepOrder);
router.post('/repfdpackage', staffAuth, AcountTransactionController.getAllFDPackage);
router.post('/repfd', staffAuth, AcountTransactionController.getAllFDAccount);



module.exports = router