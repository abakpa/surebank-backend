const staffService = require('../Service/index');
require('dotenv').config()
const crypto = require('crypto');
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')


const registerStaff = async (req, res) => {
  try {
 
  const salt = await bcrypt.genSalt()

  req.body.password = await bcrypt.hash(req.body.password,salt)
    const { name, phone, password, address,role,branchId } = req.body;
    const existingStaff = await staffService.getStaffByPhone(phone);
    if (existingStaff) {
      return res.status(400).json({ message: 'Customer number already exists' });
    }
    const newStaff = await staffService.createStaff({ name, phone, password, address, password,role,branchId });


    res.status(201).json({ message: 'Staff registered successfully', user: newStaff });
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

  module.exports = {
    registerStaff,
    getStaff,
  };