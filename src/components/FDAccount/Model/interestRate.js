const mongoose = require('mongoose');

const interestSchema = new mongoose.Schema({

  expenseInterestRate: { 
    type: Number, 
    required: true
  },
  incomeInterestRate: { 
    type: Number, 
    required: true
  },
  chargeInterestRate: { 
    type: Number, 
    required: true
  },
},
{timestamps:true}
);

const Interest = mongoose.model('Interest', interestSchema);

module.exports = Interest;
