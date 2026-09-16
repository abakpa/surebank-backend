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
    required: true,
  },
  incentivePool: {
    type: Number,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['credited'],
    default: 'credited',
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
