const express = require('express');
const router = express.Router();
const AcountTransactionController = require('../Controller/index');
const {staffAuth} = require('../../../Middleware/index')

// router.post('/', staffAuth, customerController.registerCustomer);
router.post('/repds/:id', AcountTransactionController.getAllRepDSAccount);
router.post('/repsb/:id', AcountTransactionController.getAllRepSBAccount);
router.post('/totalsbandds/:id', AcountTransactionController.getAllRepContribution);
router.post('/dailyrepds/:id', AcountTransactionController.getAllRepDailyDSAccount);
router.post('/dailyrepsb/:id', AcountTransactionController.getAllRepDailySBAccount);
router.post('/totaldailyrepcontribution/:id', AcountTransactionController.getAllRepDailyContribution);
router.post('/dailyrepdswithdrawal/:id', AcountTransactionController.getAllRepDailyDSAccountWithdrawal);
router.post('/repdspackage/:id', AcountTransactionController.getAllRepDSAccountPackage);
router.post('/repsbpackage/:id', AcountTransactionController.getAllRepSBAccountPackage);
router.post('/reppackages/:id', AcountTransactionController.getAllRepAccountPackage);
router.post('/repsbincome/:id', AcountTransactionController.getRepSBAccountIncome);
router.post('/repdsincome/:id', AcountTransactionController.getRepDSAccountIncome);
router.post('/reptotalincome/:id', AcountTransactionController.getRepAllSBandDSIncome);
router.post('/reptotalexpenditure/:id', AcountTransactionController.getRepAllExpenditure);
router.post('/repprofit/:id', AcountTransactionController.getRepProfit);
router.post('/repsbincomereport/:id', AcountTransactionController.getRepSBIncomeReport);
router.post('/repdsincomereport/:id', AcountTransactionController.getRepDSIncomeReport);
router.post('/repexpenditurereport/:id', AcountTransactionController.getRepExpenditureReport);
router.post('/reptransaction/:id',  AcountTransactionController.getTransaction);
router.post('/reporder/:id',  AcountTransactionController.getRepOrder);
router.post('/repfdpackage/:id',  AcountTransactionController.getAllFDPackage);
router.post('/repfd/:id',  AcountTransactionController.getAllFDAccount);
router.post('/branchstaff/:id',AcountTransactionController.getBranchStaff);
router.post('/repcustomer/:id', AcountTransactionController.getCustomerByRep);




module.exports = router