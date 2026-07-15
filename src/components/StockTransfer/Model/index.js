const mongoose = require('mongoose');

const stockTransferSchema = new mongoose.Schema({
  productId: {
    type: String,
    ref: 'Product',
    required: true
  },
  variationId: {
    type: String,
    default: ''
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  sourceBranchId: {
    type: String,
    ref: 'Branch',
    required: true
  },
  destinationBranchId: {
    type: String,
    ref: 'Branch',
    required: true
  },
  initiatedBy: {
    type: String,
    ref: 'Staff',
    required: true
  },
  acceptedBy: {
    type: String,
    ref: 'Staff',
    default: ''
  },
  rejectedBy: {
    type: String,
    ref: 'Staff',
    default: ''
  },
  cancelledBy: {
    type: String,
    ref: 'Staff',
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending'
  },
  note: {
    type: String,
    default: ''
  },
  responseNote: {
    type: String,
    default: ''
  },
  acceptedAt: Date,
  rejectedAt: Date,
  cancelledAt: Date
}, { timestamps: true });

stockTransferSchema.index({ sourceBranchId: 1, status: 1, createdAt: -1 });
stockTransferSchema.index({ destinationBranchId: 1, status: 1, createdAt: -1 });
stockTransferSchema.index({ productId: 1, variationId: 1 });

module.exports = mongoose.model('StockTransfer', stockTransferSchema);
