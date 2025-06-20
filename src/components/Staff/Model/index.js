const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
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
  email: {
    type: String,
    required: true,
    unique: true
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
  role: { 
    type: String, 
    required: true

  },
  status: { 
    type: String, 
    required: true,
    default: "isActive"

  },
  branchId: { 
    type: String, 
    ref:'Branch',
    required: true

  }
},
{timestamps:true}
);

const Staff = mongoose.model('Staff', staffSchema);

module.exports = Staff;
