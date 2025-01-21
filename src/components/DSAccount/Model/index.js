const mongoose = require('mongoose');

const dsaccountSchema = new mongoose.Schema({
  customerId: {
    type: String,
    required: true
  },
  accountNumber: { 
    type: String, 
    required: true 
},
DSAccountNumber: { 
    type: String, 
    required: true 
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
  },
  accountType: { 
    type: String, 
    required: true
  },
  startDate: { 
    type: String, 
    required: true
  },
  amountPerDay: { 
    type: Number, 
    required: true
  },
  hasBeenCharged: { 
    type: String, 
    required: true
  },
  totalContribution: { 
    type: Number, 
    default:0,
  },
  totalCount: { 
    type: Number, 
    default: 0,
  }
},
{timestamps:true}
);

const DSAccount = mongoose.model('DSAccount', dsaccountSchema);

module.exports = DSAccount;
