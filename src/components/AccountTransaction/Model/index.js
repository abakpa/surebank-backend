const mongoose = require('mongoose');

const accountTransactionSchema = new mongoose.Schema({
  accountNumber: { 
    type: String, 
    required: true 
},
  accountTypeId: { 
    type: String, 
    required: true 
},
  createdBy: {
    type: String,
    required: true,
  },
  accountManagerId: {
    type: String,
    required: true,
  },
  branchId: { 
    type: String, 
  },
  date: { 
    type: String, 
    required: true
  },
  amount: { 
    type: Number, 
    required: true
  },
  balance: { 
    type: Number, 
    required: true
  },
  direction: { 
    type: String, 
    required:true
  },
  narration: { 
    type: String, 
    required:true
  },
  package: { 
    type: String, 
    required:true
  }
},
{timestamps:true}
);

const AccountTransaction = mongoose.model('AccountTransaction', accountTransactionSchema);

module.exports = AccountTransaction;
