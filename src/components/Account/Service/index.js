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
          walletType: 'free_to_withdraw',
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
      return await Account.findOne({
        $or: [
          { customerId },
          { accountNumber: customerId }
        ],
        walletType: { $ne: 'sb_order_wallet' }
      });
    } catch (error) {
      throw new Error("Error checking account: " + error.message);
    }
  };
  
  const getCustomerAccount = async (customerId) => {
    try {
      const existingAccount = await checkAccount(customerId);
      const sbWalletAccount = await Account.findOne({
        customerId,
        walletType: 'sb_order_wallet'
      });
  
      return {
        account: existingAccount,
        sbWalletAccount
      };
    } catch (error) {
      throw new Error("Error retrieving customer account: " + error.message);
    }
  };
  
module.exports = {
    createAccount,
    checkAccount,
    getCustomerAccount
    
  };
