const express = require('express');
const router = express.Router();
const accountController = require('../Controller/index');

// router.post('/',accountController.createAccount);
router.post('/:id',accountController.getCustomerAccount);

module.exports = router;
