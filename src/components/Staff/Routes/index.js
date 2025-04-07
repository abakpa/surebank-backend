const express = require('express');
const router = express.Router();
const staffController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

router.post('/',staffController.registerStaff);
router.get('/',staffController.getStaff);
router.post('/branchstaff',staffAuth,staffController.getBranchStaff);

module.exports = router;
