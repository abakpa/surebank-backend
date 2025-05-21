const express = require('express');
const expenditureController = require('../Controller/index'); 
const {staffAuth} = require('../../Middleware/index')

const router = express.Router();

router.post('/', staffAuth, expenditureController.createExpenditure);
router.get('/',staffAuth, expenditureController.getExpenditure);
router.get('/:id',staffAuth, expenditureController.getExpenditureById);



module.exports = router;
