const Account = require('../../Account/Model');
const DSAccount = require('../../DSAccount/Model');
const FDAccount = require('../../FDAccount/Model');
const SBAccount = require('../../SBAccount/Model');
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
        return await Customer.find({accountManagerId:staffId});
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
  const transferAllCustomer = async (details) => {
    try {
      const { oldStaff, newStaff } = details;
  
      // Perform updates on all related collections
      const customerUpdate = await Customer.updateMany(
        { accountManagerId: oldStaff },
        { $set: { accountManagerId: newStaff } }
      );
      const accountUpdate = await Account.updateMany(
        { accountManagerId: oldStaff },
        { $set: { accountManagerId: newStaff } }
      );
      const FDAccountUpdate = await FDAccount.updateMany(
        { accountManagerId: oldStaff },
        { $set: { accountManagerId: newStaff } }
      );
      const DSAccountUpdate = await DSAccount.updateMany(
        { accountManagerId: oldStaff },
        { $set: { accountManagerId: newStaff } }
      );
      const SBAccountUpdate = await SBAccount.updateMany(
        { accountManagerId: oldStaff },
        { $set: { accountManagerId: newStaff } }
      );
  
      // Count total modified records
      const totalModified =
        customerUpdate.modifiedCount +
        accountUpdate.modifiedCount +
        FDAccountUpdate.modifiedCount +
        DSAccountUpdate.modifiedCount +
        SBAccountUpdate.modifiedCount;
  
      if (totalModified === 0) {
        throw new Error("No records were updated.");
      }
  
      return {
        success: true,
        message: `${totalModified} record(s) transferred successfully.`,
        updated: {
          customers: customerUpdate.modifiedCount,
          accounts: accountUpdate.modifiedCount,
          fdAccounts: FDAccountUpdate.modifiedCount,
          dsAccounts: DSAccountUpdate.modifiedCount,
          sbAccounts: SBAccountUpdate.modifiedCount,
        },
      };
    } catch (error) {
      console.error("Error transferring customers and accounts:", error);
      throw new Error("An error occurred while transferring records.");
    }
  };
  const transferCustomer = async (details) => {
    try {
      const { customer, newStaff } = details;
  
      const customerUpdate = await Customer.updateOne(
        { _id: customer },
        { $set: { accountManagerId: newStaff } }
      );
      const accountUpdate = await Account.updateMany(
        { customerId: customer },
        { $set: { accountManagerId: newStaff } }
      );
      const FDAccountUpdate = await FDAccount.updateMany(
        { customerId: customer },
        { $set: { accountManagerId: newStaff } }
      );
      const DSAccountUpdate = await DSAccount.updateMany(
        { customerId: customer },
        { $set: { accountManagerId: newStaff } }
      );
      const SBAccountUpdate = await SBAccount.updateMany(
        { customerId: customer },
        { $set: { accountManagerId: newStaff } }
      );
  
      const totalModified =
        customerUpdate.modifiedCount +
        accountUpdate.modifiedCount +
        FDAccountUpdate.modifiedCount +
        DSAccountUpdate.modifiedCount +
        SBAccountUpdate.modifiedCount;
  
      if (totalModified === 0) {
        throw new Error("No records were updated.");
      }
  
      return {
        success: true,
        message: `${totalModified} record(s) transferred successfully.`,
        updated: {
          customers: customerUpdate.modifiedCount,
          accounts: accountUpdate.modifiedCount,
          fdAccounts: FDAccountUpdate.modifiedCount,
          dsAccounts: DSAccountUpdate.modifiedCount,
          sbAccounts: SBAccountUpdate.modifiedCount,
        },
      };
    } catch (error) {
      console.error("Error transferring customers and accounts:", error);
      throw new Error("An error occurred while transferring records.");
    }
  };
  
  
  

  module.exports = {
    createCustomer,
    getCustomers,
    getCustomerById,
    getCustomerByBranch,
    getCustomerByRep,
    transferAllCustomer,
    transferCustomer,
  };