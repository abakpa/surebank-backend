const express = require('express');
const branchController = require('../Controller/index'); 

const router = express.Router();

router.post('/', branchController.createBranch);
router.get('/', branchController.getBranch);
router.get('/:id', branchController.getBranchById);



module.exports = router;
