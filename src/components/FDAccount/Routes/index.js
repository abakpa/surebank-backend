const express = require('express');
const router = express.Router();
const FDAccountController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

router.post('/', staffAuth, FDAccountController.createFDAccount);
router.put('/', staffAuth, FDAccountController.updateFDAccount);
router.get('/', FDAccountController.getFDAccount);
router.get('/:id', FDAccountController.getCustomerFDAccountById);
// router.post('/deposit', staffAuth, SBAccountController.saveSBContribution);
router.post('/withdrawal', staffAuth, FDAccountController.withdrawFixedDeposit);
router.post('/imaturewithdrawal', staffAuth, FDAccountController.withdrawImatureFixedDeposit);


module.exports = router;
