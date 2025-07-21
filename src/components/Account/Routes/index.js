const express = require('express');
const router = express.Router();
const accountController = require('../Controller/index');
const {staffAuth} = require('../../Middleware/index')
const {customerAuth} = require('../../Middleware/index')


// router.post('/',accountController.createAccount);
router.post('/:id',staffAuth,accountController.getCustomerAccount);
router.post('/customer/:id',customerAuth,accountController.getCustomerAccount);

module.exports = router;
