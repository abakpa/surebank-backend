const express = require('express');
const router = express.Router();
const customerController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

router.post('/', staffAuth, customerController.registerCustomer);
router.get('/branchcustomer', staffAuth, customerController.getCustomerByBranch);
router.get('/repcustomer', staffAuth, customerController.getCustomerByRep);
router.get('/', staffAuth,customerController.getCustomer);
router.get('/:id',staffAuth, customerController.getCustomerById);
router.put('/forgotpassword',customerController.resetCustomerPassword);
router.put('/:id', staffAuth,customerController.transferAllCustomer);
router.put('/updatephone/:id', staffAuth,customerController.updateCustomerPhoneNumber);
router.put('/password/:id',staffAuth,customerController.updateCustomerPassword);
router.put('/newstaff/:id',staffAuth, customerController.transferCustomer);


module.exports = router;
