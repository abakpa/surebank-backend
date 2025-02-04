const Staff = require('../Model/index');

const createStaff = async (staffData) => {
  const staff = new Staff(staffData);
  return await staff.save();
};

const getStaffByPhone = async (phone) => {
  return await Staff.findOne({ phone });
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
    getStaffByPhone,
    getStaff,
    
  };