const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
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
  updatePassword: {
    type: String,
    required: true,
    default: "false"
  },
  accountManagerId: {
    type: String,
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
