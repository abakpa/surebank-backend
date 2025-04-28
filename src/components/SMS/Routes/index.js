// routes/smsRoutes.js

const express = require('express');
const router = express.Router();
const smsController = require('../Controller/index');

// POST /api/sms/sb
router.post('/sb', smsController.sendSMSToSBAccounts);

// POST /api/sms/ds
router.post('/ds', smsController.sendSMSToDSAccounts);

module.exports = router;
