const Staff = require('../Model/index');

const createStaff = async (staffData) => {
  const staff = new Staff(staffData);
  return await staff.save();
};
const resetStaffPassword = async (staffId, password) => {
  try {
    const updatedStaff = await Staff.findByIdAndUpdate(
      staffId,
      { 
        password: password,
        updatePassword: 'false', // Indicates password was updated
      },
      { new: true } // Return the updated document
    ).select('-password'); // Exclude password in response

    if (!updatedStaff) {
      throw new Error('Staff not found');
    }

    return updatedStaff;
  } catch (error) {
    throw error;
  }
};
const getStaffByEmail = async (email) => {
  return await Staff.findOne({ email });
};
const getStaffByPhone = async (phone) => {
  return await Staff.findOne({ phone });
};


const getStaff = async () =>{
  try {
      return await Staff.find({ role: { $ne: 'Admin' } });
  } catch (error) {
      throw error;
  }
}

const getBranchStaff = async (staff) =>{
  const branch = await Staff.findOne({_id:staff})
  const branchId = branch.branchId
  try {
      return await Staff.find({branchId:branchId, role: { $ne: 'Admin' }});
  } catch (error) {
      throw error;
  }
}
const updateStaff = async (details) => {
  try {
    const { staff, status, role } = details;
    const updateFields = {};
    if (status) updateFields.status = status;
    if (role) updateFields.role = role;

    if (Object.keys(updateFields).length === 0) {
      throw new Error("No staff update supplied");
    }

    const updatedStaff = await Staff.findOneAndUpdate(
      { _id: staff },
      { $set: updateFields },
      { new: true }
    );

    if (!updatedStaff) {
      throw new Error("Staff not found or update failed");
    }

    return { success: true, message: "Updated successfully", updatedStaff };
  } catch (error) {
    console.error("Error updating staff:", error);
    throw new Error(error.message || "An error occurred while updating the staff.");
  }
};
const updateStaffPassword = async (details) => {
  try {
    const { staff, updatePassword } = details;

    const updatedStaff = await Staff.findOneAndUpdate(
      { _id: staff },
      { $set: { updatePassword } },
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
    updateStaff,
    resetStaffPassword,
    getStaffByPhone,
    updateStaffPassword
  };
