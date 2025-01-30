const Account = require("../Model/index");

const createAccount = async (customerData) => {
    //  const account = "002" + Math.floor(Math.random() * 10000000);
        const existingAccount = await checkAccount(customerData.phone);
    
        if (existingAccount) {
          return sendApiError(res, "Account already exist");
        }
    
        const accountNumber = customerData.phone;
        const customerId  = customerData.customerId
        const createdBy = customerData.staffId;
        const status = "active";
        const accountManagerId = customerData.accountManagerId;
        const branchId = customerData.branchId;
        const availableBalance = 0;
        const ledgerBalance = 0;
    
        const createCustomerAccount = {
          branchId,
          accountManagerId,
          customerId,
          accountNumber,
          createdBy,
          status,
          availableBalance,
          ledgerBalance,
        };
    const customerAccount = new Account(createCustomerAccount);
    return await customerAccount.save();
  };

  const checkAccount = async (customerId) => {
    try {
      return await Account.findOne({ customerId });
    } catch (error) {
      throw new Error("Error checking account: " + error.message);
    }
  };
  
  const getCustomerAccount = async (customerId) => {
    try {
      const existingAccount = await checkAccount(customerId);
  
      if (!existingAccount) {
        return "Invalid account number";
      }
  
      return existingAccount;
    } catch (error) {
      throw new Error("Error retrieving customer account: " + error.message);
    }
  };
  
module.exports = {
    createAccount,
    checkAccount,
    getCustomerAccount
    
  };
