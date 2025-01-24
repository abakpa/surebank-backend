const express = require('express');
const router = express.Router();
const DSAccountController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

router.post('/', staffAuth, DSAccountController.createDSAccount);
router.put('/', staffAuth, DSAccountController.updateDSAccountAmount);
router.get('/', DSAccountController.getDSAccount);
router.get('/:id', DSAccountController.getCustomerDSAccountById);
router.post('/deposit', staffAuth, DSAccountController.saveDailyContribution);


module.exports = router;
