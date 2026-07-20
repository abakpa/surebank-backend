const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  phone: { 
    type: String, 
    required: true 
},
  email: {
    type: String,
  },

  address: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true
  },
  updatePassword: {
    type: String,
    required: true,
    default: "false"
  },
  passwordResetOtp: {
    type: String,
    select: false
  },
  passwordResetOtpExpiresAt: {
    type: Date,
    select: false
  },
  passwordResetOtpAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  accountManagerId: {
    type: String,
  },
  createdBy: {
    type: String,
    required: true,
  },
  branchId: { 
    type: String, 
    ref:'Branch',
    required: true

  },
  settlementBankDetails: {
    bankName: {
      type: String,
      default: '',
    },
    accountName: {
      type: String,
      default: '',
    },
    bankAccountNumber: {
      type: String,
      default: '',
    },
  }
},
{timestamps:true}
);

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
