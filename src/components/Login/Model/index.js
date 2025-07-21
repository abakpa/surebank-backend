const mongoose = require('mongoose');

const loginSchema = new mongoose.Schema({
  customerId: {
    type: String,
    ref:'Customer',
    required: true
  },
  count: { 
    type: Number, 
    required: true,
  },
  branchId: { 
    type: String, 
    ref:'Branch',
    required: true

  },
  accountManagerId: { 
    type: String, 
    ref:'Staff',
    required: true

  },
  firstLogin:{
    type:String,
    required:true
  },
  lastLogin:{
    type:String,
    required:true
  }
},
{timestamps:true}
);

const Login = mongoose.model('Login', loginSchema);

module.exports = Login;
