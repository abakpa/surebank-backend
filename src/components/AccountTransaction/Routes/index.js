const express = require('express');
const router = express.Router();
const AcountTransactionController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')
const {customerAuth} = require('../../Middleware/index')


// router.post('/', staffAuth, customerController.registerCustomer);
router.get('/', staffAuth,AcountTransactionController.getAccountTransaction);
router.get('/:id', staffAuth,AcountTransactionController.getCustomerAcountTransactionById);
router.get('/customer/:id', customerAuth,AcountTransactionController.getCustomerAcountTransactionById);


module.exports = router;
