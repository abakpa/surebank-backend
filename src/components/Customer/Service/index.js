const Customer = require('../Model/index');

const createCustomer = async (customerData) => {
  const customer = new Customer(customerData);
  return await customer.save();
};
const getCustomerByEmail = async (email) => {
    return await Customer.findOne({ email });
  };

const getCustomers = async () =>{
    try {
        return await Customer.find({});
    } catch (error) {
        throw error;
    }
  }

  module.exports = {
    createCustomer,
    getCustomerByEmail,
    getCustomers,
  };