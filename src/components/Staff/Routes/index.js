const express = require('express');
const router = express.Router();
const staffController = require('../Controller/index');

router.post('/',staffController.registerStaff);
router.get('/',staffController.getStaff);

module.exports = router;
