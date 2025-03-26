const express = require('express');
const expenditureController = require('../Controller/index'); 

const router = express.Router();

router.post('/', expenditureController.createExpenditure);
router.get('/', expenditureController.getExpenditure);
router.get('/:id', expenditureController.getExpenditureById);



module.exports = router;
