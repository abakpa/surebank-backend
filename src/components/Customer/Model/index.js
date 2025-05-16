const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: { 
    type: String, 
    required: true 
},

  address: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true
  },
  createdBy: {
    type: String,
    required: true,
  },
  branchId: { 
    type: String, 
    ref:'Branch',
    required: true

  }
},
{timestamps:true}
);

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
