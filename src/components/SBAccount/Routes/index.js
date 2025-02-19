const express = require('express');
const router = express.Router();
const SBAccountController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

router.post('/', staffAuth, SBAccountController.createSBAccount);
router.put('/', staffAuth, SBAccountController.updateSBAccountAmount);
router.get('/', SBAccountController.getDSAccount);
router.get('/:id', SBAccountController.getCustomerSBAccountById);
router.post('/deposit', staffAuth, SBAccountController.saveSBContribution);
router.post('/withdrawal', staffAuth, SBAccountController.withdrawSBContribution);
router.post('/sellproduct', staffAuth, SBAccountController.sellProduct);


module.exports = router;
