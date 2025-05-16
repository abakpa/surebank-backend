const express = require('express');
const router = express.Router();
const customerController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

router.post('/', staffAuth, customerController.registerCustomer);
router.post('/branchcustomer', staffAuth, customerController.getCustomerByBranch);
router.post('/repcustomer', staffAuth, customerController.getCustomerByRep);
router.get('/', customerController.getCustomer);
router.get('/:id', customerController.getCustomerById);


module.exports = router;
