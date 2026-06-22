const express = require('express');
const router = express.Router();
const AnalyticsController = require('../Controller');
const { staffAuth, adminOnly } = require('../../Middleware');

router.get('/', staffAuth, adminOnly, AnalyticsController.getAnalytics);

module.exports = router;
