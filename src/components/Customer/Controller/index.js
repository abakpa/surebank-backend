const customerService = require('../Service/index');
require('dotenv').config()
const bcrypt = require('bcrypt')


    const registerCustomer = async (req, res) => {
        try {
        const salt = await bcrypt.genSalt()
        const account = "002" + Math.floor(Math.random() * 10000000);
        req.body.password = await bcrypt.hash(req.body.password,salt)
          const { name, phone, email, address, password,branch } = req.body;
          const existingCustomer = await customerService.getCustomerByEmail(email);
          if (existingCustomer) {
            return res.status(400).json({ message: 'User already exists' });
          }
          const newCustomer = await customerService.createCustomer({ name, phone, email,address, password,branch,account });
          res.status(201).json({ message: 'Customer registered successfully', user: newCustomer });
        } catch (error) {
          res.status(500).json({ message: 'Server error', error: error.message });
        }
      };
      const getCustomer = async (req, res) => {
        try {
            const customers = await customerService.getCustomers();
            res.status(200).json(customers);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }

  module.exports = {
    registerCustomer,
    getCustomer,
  };