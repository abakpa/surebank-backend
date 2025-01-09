const express = require('express');
const router = express.Router();

const branchRoutes = require('./src/components/Branch/Routes/index');
const staffRoutes = require('./src/components/Staff/Routes/index');
const loginRoutes = require('./src/components/Login/Routes/index');
const customerRoutes = require('./src/components/Customer/Routes/index');


router.use('/api/branch', branchRoutes);
router.use('/api/staff', staffRoutes);
router.use('/api/login', loginRoutes);
router.use('/api/customer', customerRoutes);


module.exports = router;
