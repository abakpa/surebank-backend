const mongoose = require('mongoose');

const fdStatementSchema = new mongoose.Schema({

    customerId: {
        type: String, 
        ref:'Customer',
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
    branchId: { 
        type: String,
        ref:'Branch',
        required: true,
      },
    expenseInterest: { 
    type: Number, 
    required: true
  },
  incomeInterest: { 
    type: Number, 
    required: true
  },
  charge: { 
    type: Number, 
    required: true
  },
  profit: { 
    type: Number, 
    required: true
  },
},
{timestamps:true}
);

const FDStatement = mongoose.model('FDStatement', fdStatementSchema);

module.exports = FDStatement;
