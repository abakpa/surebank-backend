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
const getBranchStaff = async (staff) =>{
  const branch = await Staff.findOne({_id:staff})
  const branchId = branch.branchId
  try {
      return await Staff.find({branchId:branchId});
  } catch (error) {
      throw error;
  }
}
const updateStaff = async (details) => {
  try {
    const { staff, status } = details;

    const updatedStaff = await Staff.findOneAndUpdate(
      { _id: staff },
      { $set: { status } },
      { new: true }
    );

    if (!updatedStaff) {
      throw new Error("Staff not found or update failed");
    }

    return { success: true, message: "Updated successfully", updatedStaff };
  } catch (error) {
    console.error("Error updating staff:", error);
    throw new Error("An error occurred while updating the staff status.");
  }
};


module.exports = {
    createStaff,
    getStaffByEmail,
    getStaff,
    getBranchStaff,
    updateStaff
  };