const StockTransferService = require('../Service/index');

const createTransfer = async (req, res) => {
  try {
    const data = await StockTransferService.createTransfer(req.body, req.staff);
    res.status(201).json({ data, message: 'Stock transfer sent for destination branch acceptance' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getTransfers = async (req, res) => {
  try {
    const data = await StockTransferService.getTransfers(req.staff, req.query);
    res.status(200).json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const acceptTransfer = async (req, res) => {
  try {
    const data = await StockTransferService.acceptTransfer(req.params.id, req.staff, req.body.responseNote);
    res.status(200).json({ data, message: 'Stock transfer accepted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const rejectTransfer = async (req, res) => {
  try {
    const data = await StockTransferService.rejectTransfer(req.params.id, req.staff, req.body.responseNote);
    res.status(200).json({ data, message: 'Stock transfer rejected and returned to source branch' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const cancelTransfer = async (req, res) => {
  try {
    const data = await StockTransferService.cancelTransfer(req.params.id, req.staff);
    res.status(200).json({ data, message: 'Stock transfer cancelled and returned to source branch' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createTransfer,
  getTransfers,
  acceptTransfer,
  rejectTransfer,
  cancelTransfer
};
