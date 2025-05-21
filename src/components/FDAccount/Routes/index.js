const express = require('express');
const router = express.Router();
const FDAccountController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

router.post('/', staffAuth, FDAccountController.createFDAccount);
router.post('/interest', staffAuth, FDAccountController.createInterest);
router.post('/getinterest', staffAuth, FDAccountController.getInterest);
router.put('/interest', staffAuth, FDAccountController.updateInterest);
router.put('/', staffAuth, FDAccountController.updateFDAccount);
router.get('/',staffAuth, FDAccountController.getFDAccount);
router.get('/:id',staffAuth, FDAccountController.getCustomerFDAccountById);
// router.post('/deposit', staffAuth, SBAccountController.saveSBContribution);
router.post('/withdrawal', staffAuth, FDAccountController.withdrawFixedDeposit);
router.post('/imaturewithdrawal', staffAuth, FDAccountController.withdrawImatureFixedDeposit);


module.exports = router;
