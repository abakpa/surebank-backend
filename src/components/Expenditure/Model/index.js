const mongoose = require('mongoose');

const expenditureSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  reason: { 
    type: String, 
    required: true 
},
  branchId: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
},
{timestamps:true}
);

const Expenditure = mongoose.model('Expenditure', expenditureSchema);

module.exports = Expenditure;
