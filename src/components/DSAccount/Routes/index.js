const express = require('express');
const router = express.Router();
const DSAccountController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')
const {customerAuth} = require('../../Middleware/index')

router.post('/', staffAuth, DSAccountController.createDSAccount);
router.put('/', staffAuth, DSAccountController.updateDSAccountAmount);
router.get('/',staffAuth, DSAccountController.getDSAccount);
router.get('/',staffAuth, DSAccountController.getDSAccount);
router.get('/:id',staffAuth, DSAccountController.getCustomerDSAccountById);
router.get('/customer/:id',customerAuth, DSAccountController.getCustomerDSAccountById);
router.post('/deposit', staffAuth, DSAccountController.saveDailyContribution);
router.post('/withdrawal', staffAuth, DSAccountController.withdrawDailyContribution);
router.post('/mainwithdrawal', staffAuth, DSAccountController.mainWithdrawal);


module.exports = router;
