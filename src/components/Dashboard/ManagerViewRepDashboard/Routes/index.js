const express = require('express');
const router = express.Router();
const AcountTransactionController = require('../Controller/index');
const {staffAuth} = require('../../../Middleware/index')

// router.post('/', staffAuth, customerController.registerCustomer);
router.post('/repds/:id',staffAuth, AcountTransactionController.getAllRepDSAccount);
router.post('/repsb/:id',staffAuth, AcountTransactionController.getAllRepSBAccount);
router.post('/totalsbandds/:id',staffAuth, AcountTransactionController.getAllRepContribution);
router.post('/dailyrepds/:id',staffAuth, AcountTransactionController.getAllRepDailyDSAccount);
router.post('/dailyrepfd/:id',staffAuth, AcountTransactionController.getAllRepDailyFDAccount);
router.post('/dailyrepsb/:id',staffAuth, AcountTransactionController.getAllRepDailySBAccount);
router.post('/totaldailyrepcontribution/:id',staffAuth, AcountTransactionController.getAllRepDailyContribution);
router.post('/dailyrepdswithdrawal/:id',staffAuth, AcountTransactionController.getAllRepDailyDSAccountWithdrawal);
router.post('/repdspackage/:id',staffAuth, AcountTransactionController.getAllRepDSAccountPackage);
router.post('/repsbpackage/:id',staffAuth, AcountTransactionController.getAllRepSBAccountPackage);
router.post('/reppackages/:id',staffAuth, AcountTransactionController.getAllRepAccountPackage);
router.post('/repsbincome/:id',staffAuth, AcountTransactionController.getRepSBAccountIncome);
router.post('/repdsincome/:id',staffAuth, AcountTransactionController.getRepDSAccountIncome);
router.post('/reptotalincome/:id',staffAuth, AcountTransactionController.getRepAllSBandDSIncome);
router.post('/reptotalexpenditure/:id',staffAuth, AcountTransactionController.getRepAllExpenditure);
router.post('/repprofit/:id',staffAuth, AcountTransactionController.getRepProfit);
router.post('/repsbincomereport/:id',staffAuth, AcountTransactionController.getRepSBIncomeReport);
router.post('/repdsincomereport/:id',staffAuth, AcountTransactionController.getRepDSIncomeReport);
router.post('/repexpenditurereport/:id',staffAuth, AcountTransactionController.getRepExpenditureReport);
router.post('/reptransaction/:id',staffAuth,  AcountTransactionController.getTransaction);
router.post('/reporder/:id',staffAuth,  AcountTransactionController.getRepOrder);
router.post('/repfdpackage/:id',staffAuth,  AcountTransactionController.getAllFDPackage);
router.post('/repfd/:id',staffAuth,  AcountTransactionController.getAllFDAccount);
router.post('/branchstaff/:id',staffAuth,AcountTransactionController.getBranchStaff);
router.get('/repcustomer/:id',staffAuth, AcountTransactionController.getCustomerByRep);




module.exports = router