const express = require('express');
const router = express.Router();
const accountController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

// router.post('/',accountController.createAccount);
router.post('/:id',staffAuth,accountController.getCustomerAccount);

module.exports = router;
