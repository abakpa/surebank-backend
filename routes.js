const express = require('express');
const router = express.Router();

const branchRoutes = require('./src/components/Branch/Routes/index');


router.use('/api/branch', branchRoutes);


module.exports = router;
