const express = require('express');
const router = express.Router();
const customerController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

router.post('/', staffAuth, customerController.registerCustomer);
router.get('/branchcustomer', staffAuth, customerController.getCustomerByBranch);
router.get('/repcustomer', staffAuth, customerController.getCustomerByRep);
router.get('/', staffAuth,customerController.getCustomer);
router.get('/:id',staffAuth, customerController.getCustomerById);
router.put('/:id', staffAuth,customerController.transferAllCustomer);
router.put('/newstaff/:id',staffAuth, customerController.transferCustomer);


module.exports = router;
