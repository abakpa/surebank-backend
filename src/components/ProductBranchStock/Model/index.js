const mongoose = require('mongoose');

const productBranchStockSchema = new mongoose.Schema({
  productId: {
    type: String,
    ref: 'Product',
    required: true
  },
  branchId: {
    type: String,
    ref: 'Branch',
    required: true
  },
  variationId: {
    type: String,
    default: ''
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  updatedBy: {
    type: String,
    ref: 'Staff'
  }
}, { timestamps: true });

productBranchStockSchema.index(
  { productId: 1, branchId: 1, variationId: 1 },
  { unique: true }
);

const ProductBranchStock = mongoose.model('ProductBranchStock', productBranchStockSchema);

module.exports = ProductBranchStock;
