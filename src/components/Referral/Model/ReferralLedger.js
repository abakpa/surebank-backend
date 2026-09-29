const mongoose = require('mongoose');

const referralLedgerSchema = new mongoose.Schema({
  beneficiaryCustomerId: {
    type: String,
    ref: 'Customer',
    required: true,
  },
  buyerCustomerId: {
    type: String,
    ref: 'Customer',
    required: true,
  },
  sourceOrderId: {
    type: String,
    ref: 'EcommerceOrder',
    required: true,
  },
  sourceOrderNumber: {
    type: String,
    required: true,
  },
  sourceItemId: {
    type: String,
    default: '',
  },
  productName: {
    type: String,
    default: '',
  },
  chainLevel: {
    type: Number,
    required: true,
  },
  purchaseAmount: {
    type: Number,
    required: true,
  },
  incentivePercentage: {
    type: Number,
    default: 0,
  },
  incentivePool: {
    type: Number,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  incentiveType: {
    type: String,
    enum: ['product', 'sb_qualification'],
    default: 'product',
  },
  status: {
    type: String,
    enum: ['credited'],
    default: 'credited',
  },
  branchId: {
    type: String,
    ref: 'Branch',
    default: '',
  },
  accountManagerId: {
    type: String,
    ref: 'Staff',
    default: '',
  },
  creditedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

referralLedgerSchema.index(
  { sourceOrderId: 1, beneficiaryCustomerId: 1 },
  { unique: true }
);

module.exports = mongoose.model('ReferralLedger', referralLedgerSchema);
