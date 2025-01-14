const express = require('express');
const router = express.Router();
const DSAccountController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

router.post('/', staffAuth, DSAccountController.createDSAccount);
router.get('/', DSAccountController.getDSAccount);
router.post('/deposit', staffAuth, DSAccountController.saveDailyContribution);


module.exports = router;
