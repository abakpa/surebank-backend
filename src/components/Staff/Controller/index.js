const staffService = require('../Service/index');
require('dotenv').config()
const crypto = require('crypto');
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')


const registerStaff = async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
        service: 'gmail', // You can use other services like Outlook, Yahoo, etc.
        auth: {
          user: process.env.EMAIL, // Your email address
          pass: process.env.EMAIL_PASSWORD, // Your email password or app-specific password
        },
      });
  const salt = await bcrypt.genSalt()
  const length = 12
  const generatePassword = crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  const password = await bcrypt.hash(generatePassword,salt)
    const { name, phone, email, address,role,branch } = req.body;
    const existingStaff = await staffService.getStaffByEmail(email);
    if (existingStaff) {
      return res.status(400).json({ message: 'Staff already exists' });
    }
    const newStaff = await staffService.createStaff({ name, phone, email,address, password,role,branch });

    const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: 'Your Login Credentials',
        text: `Hello ${name},\n\nYour account has been created successfully!\n\nHere are your login credentials:\nEmail: ${email}\nPassword: ${generatePassword}\n\nPlease keep them secure.\n\nBest regards,\nYour Team`,
      };
  
      await transporter.sendMail(mailOptions);
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