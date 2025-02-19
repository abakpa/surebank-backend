const Account = require('../../Account/Model');
const  generateUniqueAccountNumber  = require('../../generateAccountNumber');
const SBAccount = require('../Model/index');
const AccountTransaction = require('../../AccountTransaction/Service/index');
const SureBankAccount = require('../../SureBankAccount/Service/index')

const createSBAccount = async (SBAccountData) => {
          const existingSBAccountNumber = await getAccountByAccountNumber(SBAccountData.accountNumber);
          if (!existingSBAccountNumber) {
            throw new Error('Account number does not exists');
          }
          const existingSBAccount = await SBAccount.findOne({
            accountNumber: SBAccountData.accountNumber,
            productName: SBAccountData.productName,
});
          if (existingSBAccount) {
            throw new Error(`Customer has an active ${SBAccountData.productName} SB account running`);
          }
          const SBAccountNumber = await generateUniqueAccountNumber('SBA')
  const sbaccount = new SBAccount({...SBAccountData,customerId:existingSBAccountNumber.customerId,branchId:existingSBAccountNumber.branchId,SBAccountNumber});
  const newSBAccount = await sbaccount.save();
  return ({message:"Account created successfilly", newSBAccount})
};

const updateSBAccountAmount = async (details) => {
    const {SBAccountNumber,sellingPrice,productName,editedBy} = details
    try {
      // Validate input
      if (!SBAccountNumber) {
        throw new Error('Invalid account number');
      }
  
      const sbaccount = await SBAccount.findOne({
        SBAccountNumber: SBAccountNumber,
        // productName: productName,
      });
  
      // Find and update the DSAccount by DSAccount
      const updatedSBAccount = await SBAccount.findOneAndUpdate(
        { SBAccountNumber }, // Find the account by accountNumber
        { $set: { sellingPrice: sellingPrice, editedBy:editedBy, productName:productName } }, // Update only the amount field
        { new: true } // Return the updated document
      );
  
      // Check if the account was found and updated
      if (!updatedSBAccount) {
        throw new Error('SBAccount not found or update failed');
      }
  
      return { success: true, message: 'Updated successfully', updatedSBAccount };
    } catch (error) {
      throw new Error('An error occurred while updating the amount', error );
    }
  };

const getAccountByAccountNumber = async (accountNumber) => {
    return await Account.findOne({ accountNumber });
  };

  const getCustomerSBAccountById = async (customerId) =>{
    try {
        return await SBAccount.find({customerId:customerId});
    } catch (error) {
        throw error;
    }
  }

  const saveSBContribution = async (contributionInput) => {
    // Retrieve customer account using the DS account number
    const customerAccount = await getSBAccountByAccountNumber(contributionInput.SBAccountNumber);
    if (!customerAccount) {
      throw new Error  ('Account number does not exist.');
    }
  
    // Check for an active package with the given account type
    const sbaccount = await SBAccount.findOne({
      SBAccountNumber: contributionInput.SBAccountNumber,
      productName: contributionInput.productName,
    });
  
    if (!sbaccount) {
      throw new error('Customer does not have an active package');
    }
  
    const SBAccountId = sbaccount._id;
    const currentDate = new Date().getTime();
    const formattedDate = new Date(currentDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  
        // Retrieve and update ledger balance
        const updateLedgerBalance = await Account.findOne({ accountNumber: sbaccount.accountNumber });
  
        if (!updateLedgerBalance) {
          throw new Error('Account not found for ledger update');
        }

            const newContribution = await AccountTransaction.DepositTransactionAccount({
                createdBy: contributionInput.createdBy,
                amount: contributionInput.amount,
                balance: sbaccount.balance + contributionInput.amount,
                branchId: sbaccount.branchId,
                accountManagerId: sbaccount.accountManagerId,
                accountNumber: sbaccount.accountNumber,
                accountTypeId: SBAccountId,
                date: formattedDate,
                narration: "SB Deposit",
                direction: "Credit",
              });

              await Account.findOneAndUpdate(
                { accountNumber: sbaccount.accountNumber },
                {
                  $set: {
                    ledgerBalance: updateLedgerBalance.ledgerBalance + contributionInput.amount
                  },
                }
              );

      await SBAccount.findByIdAndUpdate(SBAccountId, {
        balance: sbaccount.balance + contributionInput.amount,
      });
    
      return { data: newContribution, message: "deposit successful" };
    }

    const withdrawSBContribution = async (contributionInput) => {
        // Retrieve customer account using the DS account number
        const customerAccount = await getSBAccountByAccountNumber(contributionInput.SBAccountNumber);
        if (!customerAccount) {
          throw new Error('Account number does not exist.');
        }
      
        // Check for an active package with the given account type
        const sbaccount = await SBAccount.findOne({
          SBAccountNumber: contributionInput.SBAccountNumber,
          productName: contributionInput.productName,
        });
      
        if (!sbaccount) {
          throw new Error('Customer does not have an active package');
        }
      
        const SBAccountId = sbaccount._id;
        const currentDate = new Date().getTime();
        const formattedDate = new Date(currentDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      
        if (contributionInput.amount > sbaccount.balance) {
          throw new Error("Insuffitient balance");
        }
      
        // Retrieve and update ledger balance
        const account = await Account.findOne({ accountNumber: sbaccount.accountNumber });
      
        if (!account) {
          throw new Error('Account not found for ledger update');
        }
        const newBalance = sbaccount.balance - contributionInput.amount;
      
          const newContribution = await AccountTransaction.DepositTransactionAccount({
            createdBy: contributionInput.createdBy,
            amount: contributionInput.amount,
            balance: newBalance,
            branchId: sbaccount.branchId,
            accountManagerId: sbaccount.accountManagerId,
            accountNumber: sbaccount.accountNumber,
            accountTypeId: SBAccountId,
            date: formattedDate,
            narration: "Withdrawal",
            direction: "Debit",
          });
      
          await Account.findOneAndUpdate(
            { accountNumber: sbaccount.accountNumber },
            {
              $set: {
                ledgerBalance: account.ledgerBalance - contributionInput.amount,
              },
            }
          );
      
          await SBAccount.findByIdAndUpdate(SBAccountId, {
            balance: newBalance
          });
      
          return { data:newContribution, message:"Withdrawal successful" };
        }
    const sellProduct = async (contributionInput) => {
        // Retrieve customer account using the DS account number
        const customerAccount = await getSBAccountByAccountNumber(contributionInput.SBAccountNumber);
        if (!customerAccount) {
          throw new Error('Account number does not exist.');
        }
      
        // Check for an active package with the given account type
        const sbaccount = await SBAccount.findOne({
          SBAccountNumber: contributionInput.SBAccountNumber,
          productName: contributionInput.productName,
        });
      
        if (!sbaccount) {
          throw new Error('Customer does not have an active package');
        }
      
        const SBAccountId = sbaccount._id;
        const currentDate = new Date().getTime();
        const formattedDate = new Date(currentDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      
        if (sbaccount.sellingPrice > sbaccount.balance) {
          throw new Error("Insuffitient amount for product price");
        }

        // if (sbaccount.sellingPrice > sbaccount.balance) {
        //   throw new Error("Insuffitient balance");
        // }
      
        // Retrieve and update ledger balance
        const account = await Account.findOne({ accountNumber: sbaccount.accountNumber });
      
        if (!account) {
          throw new Error('Account not found for ledger update');
        }
        const newBalance = sbaccount.balance - sbaccount.sellingPrice;
      
          const newContribution = await AccountTransaction.DepositTransactionAccount({
            createdBy: contributionInput.createdBy,
            amount: sbaccount.sellingPrice,
            balance: newBalance,
            branchId: sbaccount.branchId,
            accountManagerId: sbaccount.accountManagerId,
            accountNumber: sbaccount.accountNumber,
            accountTypeId: SBAccountId,
            date: formattedDate,
            narration: `${sbaccount.productName} sold`,
            direction: "Debit",
          });
      
          await Account.findOneAndUpdate(
            { accountNumber: sbaccount.accountNumber },
            {
              $set: {
                ledgerBalance: account.ledgerBalance - sbaccount.sellingPrice,
              },
            }
          );
      
          await SBAccount.findByIdAndUpdate(SBAccountId, {
            balance: newBalance
          });
      
          return { data: newContribution, message: "Product sold successful" };
        }

    const getSBAccountByAccountNumber = async (SBAccountNumber) => {
        return await SBAccount.findOne({ SBAccountNumber:SBAccountNumber });
      };

module.exports = {
    createSBAccount,
    updateSBAccountAmount,
    getCustomerSBAccountById,
    saveSBContribution,
    withdrawSBContribution,
    sellProduct
  };