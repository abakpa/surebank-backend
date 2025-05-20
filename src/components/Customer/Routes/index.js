const express = require('express');
const router = express.Router();
const customerController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

router.post('/', staffAuth, customerController.registerCustomer);
router.post('/branchcustomer', staffAuth, customerController.getCustomerByBranch);
router.post('/repcustomer', staffAuth, customerController.getCustomerByRep);
router.get('/', customerController.getCustomer);
router.get('/:id', customerController.getCustomerById);
router.put('/:id', customerController.transferAllCustomer);
router.put('/newstaff/:id', customerController.transferCustomer);


module.exports = router;
