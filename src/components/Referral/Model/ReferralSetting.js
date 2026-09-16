const mongoose = require('mongoose');

const referralRootCustomerSchema = new mongoose.Schema({
  customerId: {
    type: String,
    ref: 'Customer',
    required: true,
  },
  position: {
    type: Number,
    required: true,
  },
}, { _id: false });

const referralSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'default',
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  incentivePercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  loginBonusEnabled: {
    type: Boolean,
    default: false,
  },
  loginBonusAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  transactionBonusEnabled: {
    type: Boolean,
    default: false,
  },
  transactionBonusPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  rootCustomers: [referralRootCustomerSchema],
  shareMode: {
    type: String,
    enum: ['equal'],
    default: 'equal',
  },
  updatedBy: {
    type: String,
    ref: 'Staff',
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('ReferralSetting', referralSettingSchema);
