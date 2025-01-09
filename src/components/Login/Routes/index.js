const express = require('express');
const loginController = require('../Controller/index');

const router = express.Router();

// Login route
router.post('/', loginController.customerLogin);
router.post('/staff', loginController.staffLogin);

module.exports = router;
