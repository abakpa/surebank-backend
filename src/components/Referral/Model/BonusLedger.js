const mongoose = require('mongoose');

const bonusLedgerSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['first_login', 'transaction'],
    required: true,
  },
  customerId: {
    type: String,
    ref: 'Customer',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  depositAmount: {
    type: Number,
    default: 0,
  },
  percentage: {
    type: Number,
    default: 0,
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

module.exports = mongoose.model('BonusLedger', bonusLedgerSchema);
