const Staff = require('../../Staff/Model');
const Customer = require('../Model/index');

const createCustomer = async (customerData) => {

     const existingPhone = await getCustomerByPhone(customerData.phone);
            if (existingPhone) {
            throw new Error('Phone number already exists');
            }
  const customer = new Customer(customerData);
  return await customer.save();
};

const getCustomerByPhone = async (phone) => {
    return await Customer.findOne({ phone });
  };

const getCustomers = async () =>{
    try {
        return await Customer.find({});
    } catch (error) {
        throw error;
    }
  }
const getCustomerByBranch = async (staffId) =>{
    try {
      const branch = await Staff.findOne({_id:staffId})
        return await Customer.find({branchId:branch.branchId});
    } catch (error) {
        throw error;
    }
  }
const getCustomerByRep = async (staffId) =>{
    try {
        return await Customer.find({createdBy:staffId});
    } catch (error) {
        throw error;
    }
  }
const getCustomerById = async (customerId) =>{
    try {
        return await Customer.findOne({_id:customerId});
    } catch (error) {
        throw error;
    }
  }

  module.exports = {
    createCustomer,
    getCustomers,
    getCustomerById,
    getCustomerByBranch,
    getCustomerByRep
  };