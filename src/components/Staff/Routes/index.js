const express = require('express');
const router = express.Router();
const staffController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')

router.post('/',staffAuth,staffController.registerStaff);
router.get('/',staffAuth,staffController.getStaff);
router.put('/:id',staffAuth,staffController.updateStaff);
router.put('/password/:id',staffAuth,staffController.updateStaffPassword);
router.put('/forgotpassword/:id',staffController.resetStaffPassword);
router.get('/branchstaff',staffAuth,staffController.getBranchStaff);

module.exports = router;
