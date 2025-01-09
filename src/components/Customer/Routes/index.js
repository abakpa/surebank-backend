const express = require('express');
const router = express.Router();
const customerController = require('../Controller/index');

router.post('/', customerController.registerCustomer);
router.get('/', customerController.getCustomer);


module.exports = router;
