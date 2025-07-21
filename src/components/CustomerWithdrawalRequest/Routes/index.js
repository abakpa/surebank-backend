const express = require('express');
const router = express.Router();
const CustomerWithdrawalRequest = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')
const {customerAuth} = require('../../Middleware/index')

// router.post('/', staffAuth, DSAccountController.createDSAccount);
router.put('/:id', staffAuth, CustomerWithdrawalRequest.updateCustomerWithdrawalRequestStatus);
// router.get('/',staffAuth, DSAccountController.getDSAccount);
// router.get('/',staffAuth, DSAccountController.getDSAccount);
// router.get('/:id',staffAuth, DSAccountController.getCustomerDSAccountById);
router.get('/',staffAuth, CustomerWithdrawalRequest.getCustomersWithdrawalRequest);
router.get('/branchcustomer/:id',staffAuth, CustomerWithdrawalRequest.getBranchCustomersWithdrawalRequest);
router.get('/repcustomer',staffAuth, CustomerWithdrawalRequest.getRepCustomersWithdrawalRequest);
router.get('/customer/:id',customerAuth, CustomerWithdrawalRequest.getCustomersWithdrawalRequestForCustomer);
router.post('/', customerAuth, CustomerWithdrawalRequest.withdrawalRequest);
// router.post('/withdrawal', staffAuth, DSAccountController.withdrawDailyContribution);
// router.post('/mainwithdrawal', staffAuth, DSAccountController.mainWithdrawal);


module.exports = router;
