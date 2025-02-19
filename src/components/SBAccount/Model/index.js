const mongoose = require('mongoose');

const sbaccountSchema = new mongoose.Schema({
  customerId: {
    type: String,
    required: true
  },
  accountNumber: { 
    type: String, 
    required: true 
},
SBAccountNumber: { 
    type: String, 
    required: true 
},
  createdBy: {
    type: String,
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  productDescription: {
    type: String,
    required: true,
  },
  editedBy: {
    type: String,
    default:"No edit",
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
  },
  startDate: { 
    type: String, 
    required: true
  },
    sellingPrice: { 
    type: Number, 
    required: true
  },
  costPrice: { 
    type: Number, 
    default:0,
  },
  balance: { 
    type: Number, 
    default:0,
  },
  profit: { 
    type: Number, 
    default: 0,
  }
},
{timestamps:true}
);

const SBAccount = mongoose.model('SBAccount', sbaccountSchema);

module.exports = SBAccount;
