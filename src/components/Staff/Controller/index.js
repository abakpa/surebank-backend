const staffService = require('../Service/index');
require('dotenv').config()
const crypto = require('crypto');
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')


const registerStaff = async (req, res) => {
  try {
    // const transporter = nodemailer.createTransport({
    //     service: 'gmail', // You can use other services like Outlook, Yahoo, etc.
    //     auth: {
    //       user: process.env.EMAIL, // Your email address
    //       pass: process.env.EMAIL_PASSWORD, // Your email password or app-specific password
    //     },
    //   });
  const salt = await bcrypt.genSalt()
  // const length = 12
  // const generatePassword = crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  req.body.password = await bcrypt.hash(req.body.password,salt)
    const { firstName,lastName, phone, email, password, address,role,branchId } = req.body;
    const existingStaff = await staffService.getStaffByEmail(email);
    if (existingStaff) {
      return res.status(400).json({ message: 'Staff already exists' });
    }
    const newStaff = await staffService.createStaff({ firstName,lastName, phone, email,password, address, password,role,branchId });

    // const mailOptions = {
    //     from: process.env.EMAIL,
    //     to: email,
    //     subject: 'Your Login Credentials',
    //     text: `Hello ${name},\n\nYour account has been created successfully!\n\nHere are your login credentials:\nEmail: ${email}\nPassword: ${generatePassword}\n\nPlease keep them secure.\n\nBest regards,\nYour Team`,
    //   };
  
      // await transporter.sendMail(mailOptions);
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

  module.exports = {
    registerStaff,
    getStaff,
    getBranchStaff,
    updateStaff
  };