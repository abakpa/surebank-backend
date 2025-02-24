const Account = require('../../Account/Model');
const  generateUniqueAccountNumber  = require('../../generateAccountNumber');
const FDAccount = require('../Model/index');
const AccountTransaction = require('../../AccountTransaction/Service/index');
const SureBankAccount = require('../../SureBankAccount/Service/index')

const createFDAccount = async (FDAccountData) => {
          const existingFDAccountNumber = await getAccountByAccountNumber(FDAccountData.accountNumber);
          if (!existingFDAccountNumber) {
            throw new Error('Account number does not exists');
          }
          const interestRate = 15
          const interest = (FDAccountData.fdamount * interestRate * FDAccountData.durationMonths) / (12 * 100)
          const totalAmount = FDAccountData.fdamount + interest
          const FDAccountNumber = await generateUniqueAccountNumber('FDA')
  const fdaccount = new FDAccount({...FDAccountData,customerId:existingFDAccountNumber.customerId,branchId:existingFDAccountNumber.branchId,FDAccountNumber, interestRate,interest,totalAmount});
  const newFDAccount = await fdaccount.save();
  const account = await Account.findOne({ accountNumber: fdaccount.accountNumber });
  const FDAccountId = newFDAccount._id;
  const newContribution = await AccountTransaction.DepositTransactionAccount({
    createdBy: FDAccountData.createdBy,
    amount: newFDAccount.fdamount,
    balance: newFDAccount.totalAmount,
    branchId: newFDAccount.branchId,
    accountManagerId: newFDAccount.accountManagerId,
    accountNumber: newFDAccount.accountNumber,
    accountTypeId: FDAccountId,
    date: FDAccountData.startDate,
    narration: "Deposit",
    direction: "Credit",
  });

  await Account.findOneAndUpdate(
    { accountNumber: newFDAccount.accountNumber },
    {
      $set: {
        ledgerBalance: account.ledgerBalance + newFDAccount.fdamount,
      },
    }
  );
  return ({message:"Fixed deposit account created successfilly", newFDAccount})
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

  const getCustomerFDAccountById = async (customerId) =>{
    try {
        return await FDAccount.find({customerId:customerId});
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
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit", // Abbreviated year (YY)
      hour: "2-digit",
      minute: "2-digit",
      hour12: true, // Ensures AM/PM format
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

    const withdrawFDContribution = async (contributionInput) => {
        // Retrieve customer account using the DS account number
        const customerAccount = await getFDAccountByAccountNumber(contributionInput.FDAccountNumber);
        if (!customerAccount) {
          throw new Error('Account number does not exist.');
        }
      
        // Check for an active package with the given account type
        const fdaccount = await FDAccount.findOne({
          FDAccountNumber: contributionInput.FDAccountNumber,
          status: 'Active',
        });
      
        if (!fdaccount) {
          throw new Error('Customer does not have an active package');
        }
      
        const FDAccountId = fdaccount._id;
        const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit", // Abbreviated year (YY)
      hour: "2-digit",
      minute: "2-digit",
      hour12: true, // Ensures AM/PM format
    });
      
    const today = new Date();
    today.setHours(0, 0, 0, 0);
        const maturityDate = new Date(fdaccount.maturityDate);
        maturityDate.setHours(0, 0, 0, 0);

        if (today < maturityDate) {
            throw new Error("Cannot withdraw before maturity date" );
        }
        // Retrieve and update ledger balance
        const account = await Account.findOne({ accountNumber: fdaccount.accountNumber });
      
        if (!account) {
          throw new Error('Account not found for ledger update');
        }
        // const newBalance = fdaccount.balance - fdaccount.amount;
      
          const newContribution = await AccountTransaction.DepositTransactionAccount({
            createdBy: contributionInput.createdBy,
            amount: fdaccount.totalAmount,
            balance: 0,
            branchId: fdaccount.branchId,
            accountManagerId: fdaccount.accountManagerId,
            accountNumber: fdaccount.accountNumber,
            accountTypeId: FDAccountId,
            date: formattedDate,
            narration: "Withdrawal",
            direction: "Debit",
          });
      
          await Account.findOneAndUpdate(
            { accountNumber: fdaccount.accountNumber },
            {
              $set: {
                ledgerBalance: account.ledgerBalance - fdaccount.fdamount,
              },
            }
          );
      
          await FDAccount.findByIdAndUpdate(FDAccountId, {
            totalAmount: 0,
            status:'Matured'
          });
      
          return { data:newContribution, message:"Withdrawal successful" };
        }
    const withdrawImatureFDContribution = async (contributionInput) => {
        const customerAccount = await getFDAccountByAccountNumber(contributionInput.FDAccountNumber);
        if (!customerAccount) {
          throw new Error('Account number does not exist.');
        }
      
        // Check for an active package with the given account type
        const fdaccount = await FDAccount.findOne({
          FDAccountNumber: contributionInput.FDAccountNumber,
          status: 'Active'
        });
      
        if (!fdaccount) {
          throw new Error('Customer does not have an active package');
        }
      
        const FDAccountId = fdaccount._id;
        const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit", // Abbreviated year (YY)
      hour: "2-digit",
      minute: "2-digit",
      hour12: true, // Ensures AM/PM format
    });
    const balance = fdaccount.totalAmount - fdaccount.interest
      
        if (contributionInput.fdamount > balance) {
          throw new Error("Insuffitient balance");
        }
      
        // Retrieve and update ledger balance
        const account = await Account.findOne({ accountNumber: fdaccount.accountNumber });
      
        if (!account) {
          throw new Error('Account not found for ledger update');
        }
        const newBalance = balance - contributionInput.fdamount;
      
          const newContribution = await AccountTransaction.DepositTransactionAccount({
            createdBy: contributionInput.createdBy,
            amount: contributionInput.fdamount,
            balance: 0,
            branchId: fdaccount.branchId,
            accountManagerId: fdaccount.accountManagerId,
            accountNumber: fdaccount.accountNumber,
            accountTypeId: FDAccountId,
            date: formattedDate,
            narration: "Withdrawal",
            direction: "Debit",
          });
              await AccountTransaction.DepositTransactionAccount({
                  createdBy: contributionInput.createdBy,
                  amount:  newBalance,
                  balance: account.availableBalance + newBalance,
                  branchId: account.branchId,
                  accountManagerId: account.accountManagerId,
                  accountNumber: account.accountNumber,
                  accountTypeId: account._id,
                  date: formattedDate,
                  narration: "From FD account",
                  direction: "Credit",
                });
      
          await Account.findOneAndUpdate(
            { accountNumber: fdaccount.accountNumber },
            {
              $set: {
                ledgerBalance: account.ledgerBalance - contributionInput.fdamount,
                availableBalance: account.availableBalance + newBalance,
              },
            }
          );
      
          await FDAccount.findByIdAndUpdate(FDAccountId, {
            totalAmount: 0,
            status:'Matured'
          });
      
          return { data:newContribution, message:"Withdrawal successful" };
        }
        const updateFDAccountAmount = async (details) => {
            try {
              const { FDAccountNumber, fdamount, maturityDate, durationMonths, editedBy, startDate } = details;
          
              // Validate input
              if (!FDAccountNumber || !fdamount || typeof fdamount !== 'number' || fdamount < 1000) {
                throw new Error('Invalid account number or amount. Amount must be at least 1000.');
              }
          
              // Find the Fixed Deposit account
              const fdaccount = await FDAccount.findOne({ FDAccountNumber });
          
              if (!fdaccount) {
                throw new Error('FDAccount not found.');
              }
          
              if (fdaccount.totalAmount !== 0) {
                throw new Error('You cannot edit the amount while the package is running.');
              }
          
              // Calculate interest and total amount
              const interestRate = 15; // Assuming 15% annual interest
              const interest = (fdamount * interestRate * durationMonths) / (12 * 100);
              const totalAmount = fdamount + interest;
          
              // Update FDAccount
              const updatedFDAccount = await FDAccount.findOneAndUpdate(
                { FDAccountNumber },
                {
                  $set: {
                    fdamount,
                    totalAmount,
                    maturityDate,
                    editedBy,
                    status: 'Active',
                    interest,
                    startDate,
                  },
                },
                { new: true }
              );
          
              if (!updatedFDAccount) {
                throw new Error('FDAccount update failed.');
              }
          
              // Record deposit transaction
              await AccountTransaction.DepositTransactionAccount({
                createdBy: editedBy,
                amount:fdamount,
                balance: totalAmount,
                branchId: fdaccount.branchId,
                accountManagerId: fdaccount.accountManagerId,
                accountNumber: fdaccount.accountNumber,
                accountTypeId: fdaccount._id,
                date: startDate,
                narration: "Deposit",
                direction: "Credit",
              });
          
              return { success: true, message: 'Amount updated successfully', updatedFDAccount };
          
            } catch (error) {
              return (`An error occurred while updating the account: ${error.message}`);
            }
          };
          
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
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "2-digit", // Abbreviated year (YY)
          hour: "2-digit",
          minute: "2-digit",
          hour12: true, // Ensures AM/PM format
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

    const getFDAccountByAccountNumber = async (FDAccountNumber) => {
        return await FDAccount.findOne({ FDAccountNumber:FDAccountNumber });
      };

module.exports = {
    createFDAccount,
    updateSBAccountAmount,
    getCustomerFDAccountById,
    saveSBContribution,
    withdrawFDContribution,
    sellProduct,
    withdrawImatureFDContribution,
    updateFDAccountAmount
  };