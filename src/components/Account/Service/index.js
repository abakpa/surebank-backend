const Account = require("../Model/index");

const createAccount = async (customerData) => {
     const account = "002" + Math.floor(Math.random() * 10000000);
    
        const existingAccount = await checkAccount(account);
    
        if (existingAccount) {
          return sendApiError(res, "Account already exist");
        }
    
        const accountNumber = account;
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

const checkAccount = async (account) => {
    return await Account.findOne({ account });
  };
module.exports = {
    createAccount,
    checkAccount
    
  };
