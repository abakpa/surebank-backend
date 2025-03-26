const mongoose = require('mongoose');

const dsbalanceSchema = new mongoose.Schema({
  branchId: {
    type: String,
    required: true
  },
  balance: { 
    type: String, 
    required: true 
},
},
{timestamps:true}
);

const DSBalance = mongoose.model('DSBalance', dsbalanceSchema);

module.exports = DSBalance;
