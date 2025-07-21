const express = require('express');
const loginController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

const router = express.Router();

// Login route
router.post('/', loginController.customerLogin);
router.post('/staff', loginController.staffLogin);
router.get('/customercount', loginController.getCustomers);
router.get('/repcustomercount', staffAuth, loginController.getRepCustomers);
router.get('/branchcustomercount/:id', loginController.getBranchCustomers);
router.post('/staff/block-all-users', staffAuth, loginController.blockAllUsers);
router.post('/staff/unblock-all-users', staffAuth, loginController.unblockAllUsers);

module.exports = router;
