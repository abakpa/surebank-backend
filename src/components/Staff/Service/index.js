const Staff = require('../Model/index');

const createStaff = async (staffData) => {
  const staff = new Staff(staffData);
  return await staff.save();
};

const getStaffByEmail = async (email) => {
  return await Staff.findOne({ email });
};


const getStaff = async () =>{
  try {
      return await Staff.find({});
  } catch (error) {
      throw error;
  }
}

module.exports = {
    createStaff,
    getStaffByEmail,
    getStaff,
    
  };