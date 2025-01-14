const express = require('express');
const router = express.Router();
const AcountTransactionController = require('../Controller/index');
// const {staffAuth} = require('../../Middleware/index')

// router.post('/', staffAuth, customerController.registerCustomer);
router.get('/', AcountTransactionController.getAccountTransaction);
router.get('/:id', AcountTransactionController.getCustomerAcountTransactionById);


module.exports = router;
