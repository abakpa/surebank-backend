const mongoose = require('mongoose');

const customerWithdrawalRequestSchema = new mongoose.Schema({
  customerId: { 
    type: String, 
    ref:'Customer',
    required: true 
},
  accountNumber: { 
    type: String, 
    required: true 
},
  accountTypeId: { 
    type: String, 
    required: true 
},

  accountManagerId: {
    type: String,
    required: true,
  },
  branchId: { 
    type: String, 
    ref:'Branch'
  },
  date: { 
    type: String, 
    required: true
  },
  channelOfWithdrawal: { 
    type: String, 
    required: true
  },
  bankName: { 
    type: String, 
  },
  accountName: { 
    type: String, 
  },
  bankAccountNumber: { 
    type: String, 
  },
  amount: { 
    type: Number, 
    required: true
  },

  package: { 
    type: String, 
    required:true
  },
  status: { 
    type: String, 
    default:'Pending',
    required:true
  }
},
{timestamps:true}
);

const CustomerWithdrawalRequest = mongoose.model('CustomerWithdrawalRequest', customerWithdrawalRequestSchema);

module.exports = CustomerWithdrawalRequest;
