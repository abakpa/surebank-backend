const customerService = require('../Service/index');
const accountService = require('../../Account/Service/index')
require('dotenv').config()
const bcrypt = require('bcrypt')


    const registerCustomer = async (req, res) => {
        try {
          const staffId = req.staff.staffId;
          const createdBy = staffId
        const salt = await bcrypt.genSalt()
        req.body.password = await bcrypt.hash(req.body.password,salt)
          const { firstName,lastName, phone, address, password,branchId,accountManagerId } = req.body;
          const newCustomer = await customerService.createCustomer({ firstName,lastName, phone, address,createdBy,accountManagerId, password,branchId });
          const accountNumber = await accountService.createAccount({customerId:newCustomer._id,staffId:staffId,branchId,accountManagerId,phone:phone})
          res.status(201).json({ message: 'Customer registered successfully', user: newCustomer,accountNumber:accountNumber });
        } catch (error) {
          res.status(500).json({ error: error.message });
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
      const getCustomerByBranch = async (req, res) => {
        const staffId = req.staff.staffId;

        try {
            const customers = await customerService.getCustomerByBranch(staffId);
            res.status(200).json(customers);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getCustomerByRep = async (req, res) => {
        const staffId = req.staff.staffId;

        try {
            const customers = await customerService.getCustomerByRep(staffId);
            res.status(200).json(customers);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getCustomerById = async (req, res) => {
        try {
          const customerId = req.params.id
            const customer = await customerService.getCustomerById(customerId);
            res.status(200).json(customer);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
           const transferAllCustomer = async (req,res) => {
            const oldStaff = req.params.id
            const newStaff = req.query.newStaff
                try {
              const newData = await customerService.transferAllCustomer({oldStaff,newStaff})
                  res.status(201).json({ data: newData });
                } catch (error) {
                  return { success: false, message: 'An error occurred while updating', error };
                }
              };
           const transferCustomer = async (req,res) => {
            const customer = req.params.id
            const newStaff = req.query.newStaff
                try {
              const newData = await customerService.transferCustomer({customer,newStaff})
                  res.status(201).json({ data: newData });
                } catch (error) {
                  return { success: false, message: 'An error occurred while updating', error };
                }
              };

  module.exports = {
    registerCustomer,
    getCustomer,
    getCustomerById,
    getCustomerByBranch,
    getCustomerByRep,
    transferAllCustomer,
    transferCustomer,
  };