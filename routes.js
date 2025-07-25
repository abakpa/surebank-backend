const express = require('express');
const router = express.Router();

const branchRoutes = require('./src/components/Branch/Routes/index');
const staffRoutes = require('./src/components/Staff/Routes/index');
const loginRoutes = require('./src/components/Login/Routes/index');
const customerRoutes = require('./src/components/Customer/Routes/index');
const dsaccountRoutes = require('./src/components/DSAccount/Routes/index');
const sbaccountRoutes = require('./src/components/SBAccount/Routes/index');
const fdaccountRoutes = require('./src/components/FDAccount/Routes/index');
const accountRoutes = require('./src/components/Account/Routes/index');
const accountTransactionRoutes = require('./src/components/AccountTransaction/Routes/index');
const adminDashboard = require('./src/components/Dashboard/AdminDashboard/Routes/index');
const managerDashboard = require('./src/components/Dashboard/ManagerDashboard/Routes/index');
const repDashboard = require('./src/components/Dashboard/RepDashboard/Routes/index');
const mvrepDashboard = require('./src/components/Dashboard/ManagerViewRepDashboard/Routes/index');
const expenditureRoutes = require('./src/components/Expenditure/Routes/index');
const smsRoutes = require('./src/components/SMS/Routes/index');
const customerWithdrawalRequestRoutes = require('./src/components/CustomerWithdrawalRequest/Routes/index');


router.use('/api/branch', branchRoutes);
router.use('/api/staff', staffRoutes);
router.use('/api/login', loginRoutes);
router.use('/api/customer', customerRoutes);
router.use('/api/dsaccount', dsaccountRoutes);
router.use('/api/sbaccount', sbaccountRoutes);
router.use('/api/fdaccount', fdaccountRoutes);
router.use('/api/account', accountRoutes);
router.use('/api/customertransaction', accountTransactionRoutes);
router.use('/api/admindashboard', adminDashboard);
router.use('/api/managerdashboard',managerDashboard);
router.use('/api/repdashboard',repDashboard);
router.use('/api/mvrepdashboard',mvrepDashboard);
router.use('/api/expenditure', expenditureRoutes);
router.use('/api/sms', smsRoutes);
router.use('/api/customerwithdrawalrequest', customerWithdrawalRequestRoutes);


module.exports = router;
