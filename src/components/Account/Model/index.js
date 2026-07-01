const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  customerId: {
    type: String,
    ref:'Customer',
    required: true
  },
  accountNumber: { 
    type: String, 
    required: true 
},
  walletType: {
    type: String,
    enum: ['free_to_withdraw', 'sb_order_wallet'],
    default: 'free_to_withdraw',
  },
  availableBalance: {
    type: Number,
    required: true,
  },
  ledgerBalance: {
    type: Number,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  accountManagerId: {
    type: String,
  },
  branchId: { 
    type: String, 
  },
  status: { 
    type: String, 
    required: true
  }
},
{timestamps:true}
);

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;
