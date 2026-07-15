const express = require('express');
const router = express.Router();
const StockTransferController = require('../Controller/index');
const { staffAuth, managerOnly } = require('../../Middleware/index');

router.get('/', staffAuth, StockTransferController.getTransfers);
router.post('/', staffAuth, managerOnly, StockTransferController.createTransfer);
router.put('/:id/accept', staffAuth, managerOnly, StockTransferController.acceptTransfer);
router.put('/:id/reject', staffAuth, managerOnly, StockTransferController.rejectTransfer);
router.put('/:id/cancel', staffAuth, managerOnly, StockTransferController.cancelTransfer);

module.exports = router;
