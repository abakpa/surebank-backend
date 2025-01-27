const Customer = require('../Model/index');

const createCustomer = async (customerData) => {
     const existingCustomer = await getCustomerByEmail(customerData.email);
            if (existingCustomer) {
            throw new Error('Email already exists');
            }
     const existingPhone = await getCustomerByPhone(customerData.phone);
            if (existingPhone) {
            throw new Error('Phone number already exists');
            }
  const customer = new Customer(customerData);
  return await customer.save();
};
const getCustomerByEmail = async (email) => {
    return await Customer.findOne({ email });
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
const getCustomerById = async (customerId) =>{
    try {
        return await Customer.findOne({_id:customerId});
    } catch (error) {
        throw error;
    }
  }

  module.exports = {
    createCustomer,
    getCustomerByEmail,
    getCustomers,
    getCustomerById
  };