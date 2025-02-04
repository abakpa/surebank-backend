const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
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
  role: { 
    type: String, 
    required: true

  },
  branchId: { 
    type: String, 
    required: true

  }
},
{timestamps:true}
);

const Staff = mongoose.model('Staff', staffSchema);

module.exports = Staff;
