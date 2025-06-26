const Account = require('../../Account/Model');
const AccountTransaction = require('../../AccountTransaction/Model');
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
const resetCustomerPassword = async (customerId, password) => {
  try {
    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      { 
        password: password,
        updatePassword: 'false', // Indicates password was updated
      },
      { new: true } // Return the updated document
    ).select('-password'); // Exclude password in response

    if (!updatedCustomer) {
      throw new Error('Customer not found');
    }

    return updatedCustomer;
  } catch (error) {
    throw error;
  }
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
  const updateCustomerPhoneNumber = async (details) => {
    try {
      const { customer, phone } = details;
  
      const customerUpdate = await Customer.updateOne(
        { _id: customer },
        { $set: { phone: phone } }
      );
      const accountUpdate = await Account.updateMany(
        { customerId: customer },
        { $set: { accountNumber: phone } }
      );
      const FDAccountUpdate = await FDAccount.updateMany(
        { customerId: customer },
        { $set: { accountNumber: phone } }
      );
      const DSAccountUpdate = await DSAccount.updateMany(
        { customerId: customer },
        { $set: { accountNumber: phone } }
      );
      const SBAccountUpdate = await SBAccount.updateMany(
        { customerId: customer },
        { $set: { accountNumber: phone } }
      );
      const accountTransactionUpdate = await AccountTransaction.updateMany(
        { customerId: customer },
        { $set: { accountNumber: phone } }
      );
  
      const totalModified =
        customerUpdate.modifiedCount +
        accountUpdate.modifiedCount +
        FDAccountUpdate.modifiedCount +
        DSAccountUpdate.modifiedCount +
        accountTransactionUpdate.modifiedCount +
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
  const updateCustomerPassword = async (details) => {
    try {
      const { customer, updatePassword } = details;
  
      const updatedCustomer = await Customer.findOneAndUpdate(
        { _id: customer },
        { $set: { updatePassword } },
        { new: true }
      );
  
      if (!updatedCustomer) {
        throw new Error("Staff not found or update failed");
      }
  
      return { success: true, message: "Updated successfully", updatedCustomer };
    } catch (error) {
      console.error("Error updating staff:", error);
      throw new Error("An error occurred while updating the staff status.");
    }
  };
  
  

  module.exports = {
    createCustomer,
    getCustomers,
    getCustomerById,
    getCustomerByPhone,
    getCustomerByBranch,
    getCustomerByRep,
    transferAllCustomer,
    transferCustomer,
    resetCustomerPassword,
    updateCustomerPassword,
    updateCustomerPhoneNumber
  };