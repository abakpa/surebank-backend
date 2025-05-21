const express = require('express');
const branchController = require('../Controller/index'); 
const {staffAuth} = require('../../Middleware/index')

const router = express.Router();

router.post('/',staffAuth, branchController.createBranch);
router.get('/', staffAuth,branchController.getBranch);
router.get('/:id',staffAuth, branchController.getBranchById);



module.exports = router;
