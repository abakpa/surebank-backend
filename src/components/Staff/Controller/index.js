const staffService = require('../Service/index');
require('dotenv').config()
const crypto = require('crypto');
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')


const registerStaff = async (req, res) => {
  try {
 
  const salt = await bcrypt.genSalt()

  req.body.password = await bcrypt.hash(req.body.password,salt)
    const { firstName,lastName, phone, email, password, address,role,branchId,referral } = req.body;
    const existingStaff = await staffService.getStaffByEmail(email);
    if (existingStaff) {
      return res.status(400).json({ message: 'Staff already exists' });
    }
    const newStaff = await staffService.createStaff({ firstName,lastName, phone, email,password, address,role,branchId,referral });

    res.status(201).json({ message: 'Staff registered successfully', user: newStaff });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
const resetStaffPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Check if staff exists
    const existingStaff = await staffService.getStaffByEmail(email);
    if (!existingStaff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt();
    const password = await bcrypt.hash(newPassword, salt);

    // Update password and set updatePassword to true
    const updatedStaff = await staffService.resetStaffPassword(
      existingStaff._id,
      password
    );

    res.status(200).json({
      message: 'Password reset successfully',
      user: updatedStaff,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
const getStaff = async (req, res) => {
    try {
        const staff = await staffService.getStaff();
        res.status(200).json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
  }

const getBranchStaff = async (req, res) => {

  const staffId = req.staff.staffId;
    try {
        const staff = await staffService.getBranchStaff(staffId);
        res.status(200).json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
  }
     const updateStaff = async (req,res) => {
      const staff = req.params.id
      const status = req.query.status
          try {
        const newData = await staffService.updateStaff({staff,status})
            res.status(201).json({ data: newData });
          } catch (error) {
            return { success: false, message: 'An error occurred while updating', error };
          }
        };
     const updateStaffPassword = async (req,res) => {
      const staff = req.params.id
      const updatePassword = "true"
          try {
        const newData = await staffService.updateStaffPassword({staff,updatePassword})
            res.status(201).json({ data: newData });
          } catch (error) {
            return { success: false, message: 'An error occurred while updating', error };
          }
        };

  module.exports = {
    registerStaff,
    getStaff,
    getBranchStaff,
    updateStaff,
    resetStaffPassword,
    updateStaffPassword
  };