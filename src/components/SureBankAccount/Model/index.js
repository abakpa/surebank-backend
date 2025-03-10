const mongoose = require('mongoose');

const sureBankAccountTransactionSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true 
},
package: { 
    type: String, 
    required: true 
},
  direction: { 
    type: String, 
    required: true 
},
  date: {
    type: String,
    required: true,
  },
  narration: {
    type: String,
    required: true,
  },
  branchId: { 
    type: String, 
  },
  amount: { 
    type: Number, 
    required: true
  },
  customerId: { 
    type: String, 
    required: true
  },
},
{timestamps:true}
);

const SureBankAccountTransaction = mongoose.model('SureBankAccountTransaction', sureBankAccountTransactionSchema);

module.exports = SureBankAccountTransaction;
