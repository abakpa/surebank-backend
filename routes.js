const express = require('express');
const router = express.Router();

const branchRoutes = require('./src/components/Branch/Routes/index');
const staffRoutes = require('./src/components/Staff/Routes/index');


router.use('/api/branch', branchRoutes);
router.use('/api/staff', staffRoutes);


module.exports = router;
