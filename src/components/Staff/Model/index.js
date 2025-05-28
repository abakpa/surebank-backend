const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  firseName: {
    type: String,
    required: true
  },
  LastName: {
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
