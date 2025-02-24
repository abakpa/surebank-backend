const mongoose = require('mongoose');

const fdaccountSchema = new mongoose.Schema({
  customerId: {
    type: String,
    required: true
  },
  accountNumber: { 
    type: String, 
    required: true 
},
FDAccountNumber: { 
    type: String, 
    required: true 
},
durationMonths: { 
    type: Number, 
    required: true 
},
  createdBy: {
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
  maturityDate: { 
    type: String, 
    required: true
  },
    fdamount: { 
    type: Number, 
    required: true
  },
  interestRate: { 
    type: Number, 
    required: true, 
},
  interest: { 
    type: Number, 
  },
  totalAmount: { 
    type: Number, 
  },

},
{timestamps:true}
);

const FDAccount = mongoose.model('FDAccount', fdaccountSchema);

module.exports = FDAccount;
