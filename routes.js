const express = require('express');
const router = express.Router();

const branchRoutes = require('./src/components/Branch/Routes/index');
const staffRoutes = require('./src/components/Staff/Routes/index');
const loginRoutes = require('./src/components/Login/Routes/index');
const customerRoutes = require('./src/components/Customer/Routes/index');
const dsaccountRoutes = require('./src/components/DSAccount/Routes/index');
const accountRoutes = require('./src/components/Account/Routes/index');
const accountTransactionRoutes = require('./src/components/AccountTransaction/Routes/index');


router.use('/api/branch', branchRoutes);
router.use('/api/staff', staffRoutes);
router.use('/api/login', loginRoutes);
router.use('/api/customer', customerRoutes);
router.use('/api/dsaccount', dsaccountRoutes);
router.use('/api/account', accountRoutes);
router.use('/api/customertransaction', accountTransactionRoutes);


module.exports = router;
