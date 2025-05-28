const Account = require('../../Account/Model');
const  generateUniqueAccountNumber  = require('../../generateAccountNumber');
const FDAccount = require('../Model/index');
const AccountTransaction = require('../../AccountTransaction/Service/index');
const SureBankAccount = require('../../SureBankAccount/Service/index');
const Interest = require('../Model/interestRate');
const FDStatement = require('../Model/fdStatement')


const createInterest = async (data) => {
    try {
        const interest = new Interest(data);
        await interest.save();
        return interest;
    } catch (error) {
        throw error;
    }
};
const getInterest = async () => {
    try {
        return await Interest.find({});
    } catch (error) {
        throw error;
    }
};
const getFDStatement = async () => {
    try {
        const fdstatement = await FDStatement.find({})
          .populate ({
            path: 'branchId',
            model: 'Branch',
          
        })
        .populate({
          path: 'customerId', // Populate customer details using customerId directly in AccountTransaction
          model: 'Customer',
        })
        .sort({ status: 1 });
        return fdstatement
    } catch (error) {
        throw error;
    }
    
};
const updateInterest = async (details) => {
    const {expenseInterestRate,incomeInterestRate,chargeInterestRate,editedBy} = details
    try {
    
      // Find and update the DSAccount by DSAccount
      const updatedInterest = await Interest.findOneAndUpdate(
        {},
        { $set: { expenseInterestRate: expenseInterestRate, editedBy:editedBy, incomeInterestRate:incomeInterestRate,chargeInterestRate:chargeInterestRate } }, // Update only the amount field
        { new: true } // Return the updated document
      );
  
      // Check if the account was found and updated
      if (!updatedInterest) {
        throw new Error('SBAccount not found or update failed');
      }
  
      return { success: true, message: 'Updated successfully', updatedInterest };
    } catch (error) {
      throw new Error('An error occurred while updating the amount', error );
    }
  };

const createFDAccount = async (FDAccountData) => {
          const existingFDAccountNumber = await getAccountByAccountNumber(FDAccountData.accountNumber);
          if (!existingFDAccountNumber) {
            throw new Error('Account number does not exists');
          }
          const {
            createdBy,
            startDate,
            accountNumber,
            accountManagerId,
            fdamount,
            durationMonths,
            maturityDate,
            status,
          } = FDAccountData
          const getInterest = await Interest.findOne()
          const expenseInterestRate = getInterest.expenseInterestRate
          const incomeInterestRate = getInterest.incomeInterestRate
          const chargeInterestRate = getInterest.chargeInterestRate
          const chargeInterest = (FDAccountData.fdamount * chargeInterestRate * FDAccountData.durationMonths) / (12 * 100)
          const expenseInterest = (FDAccountData.fdamount * expenseInterestRate * FDAccountData.durationMonths) / (12 * 100)
          const incomeInterest = (FDAccountData.fdamount * incomeInterestRate * FDAccountData.durationMonths) / (12 * 100)
          const totalAmount = FDAccountData.fdamount + expenseInterest
          const FDAccountNumber = await generateUniqueAccountNumber('FDA')
  const fdaccount = new FDAccount({
    createdBy,
    startDate,
    accountNumber,
    accountManagerId,
    fdamount,
    durationMonths,
    maturityDate,
    status,
    customerId:existingFDAccountNumber.customerId,
    branchId:existingFDAccountNumber.branchId,
    FDAccountNumber,
    incomeInterestRate,
    incomeInterest,
    chargeInterest,
    chargeInterestRate, 
    expenseInterestRate,
    expenseInterest,
    totalAmount
  });
  const newFDAccount = await fdaccount.save();
  const account = await Account.findOne({ accountNumber: fdaccount.accountNumber });
  const FDAccountId = newFDAccount._id;
  const newContribution = await AccountTransaction.DepositTransactionAccount({
    createdBy: FDAccountData.createdBy,
    customerId:existingFDAccountNumber.customerId,
    amount: newFDAccount.fdamount,
    balance: newFDAccount.totalAmount,
    branchId: newFDAccount.branchId,
    accountManagerId: newFDAccount.accountManagerId,
    accountNumber: newFDAccount.accountNumber,
    accountTypeId: FDAccountId,
    date: FDAccountData.startDate,
    package: "FD",
    narration: "Deposit",
    direction: "Credit",
  });
  await Account.findOneAndUpdate(
    { accountNumber: newFDAccount.accountNumber },
    {
      $set: {
        ledgerBalance: account.ledgerBalance + totalAmount,
      },
    }
  );
  const newContribution2 = await AccountTransaction.DepositTransactionAccount({
    createdBy: FDAccountData.createdBy,
    amount: expenseInterest,
    customerId:existingFDAccountNumber.customerId,
    balance: totalAmount - expenseInterest,
    branchId: newFDAccount.branchId,
    accountManagerId: newFDAccount.accountManagerId,
    accountNumber: newFDAccount.accountNumber,
    accountTypeId: FDAccountId,
    date: FDAccountData.startDate,
    package:"FD",
    narration: "Interest",
    direction: "Debit",
  });
      await AccountTransaction.DepositTransactionAccount({
          createdBy: FDAccountData.createdBy,
          customerId:existingFDAccountNumber.customerId,
          amount:  expenseInterest,
          balance: account.availableBalance + expenseInterest,
          branchId: account.branchId,
          accountManagerId: account.accountManagerId,
          accountNumber: account.accountNumber,
          accountTypeId: account._id,
          date: FDAccountData.startDate,
          package:"FDTRANSFER",
          narration: "From FD account",
          direction: "Credit",
        });

  await Account.findOneAndUpdate(
    { accountNumber: fdaccount.accountNumber },
    {
      $set: {
        availableBalance: account.availableBalance + expenseInterest,
      },
    }
  );
     const sureBankDeposit = {
        package:"FD",
         date: FDAccountData.startDate,
         direction: "Credit",
         narration: "FD Income",
         branchId: account.branchId,
         amount: incomeInterest - expenseInterest,
         customerId:existingFDAccountNumber.customerId,
         type:account._id
       }
  
       await SureBankAccount.DepositTransactionAccount({...sureBankDeposit});
     const fdStatement = {
         customerId:existingFDAccountNumber.customerId,
         accountNumber: newFDAccount.accountNumber,
         FDAccountNumber,
         branchId: account.branchId,
         incomeInterest,
         expenseInterest,
         charge:0,
         profit: incomeInterest - expenseInterest
       }
       const fdincomestatement = new FDStatement(fdStatement);
       await fdincomestatement.save();
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
           
        if (contributionInput.fdamount > fdaccount.fdamount) {
          throw new Error("Insuffitient balance");
        }
        // const newBalance = fdaccount.balance - fdaccount.amount;
      
          const newContribution = await AccountTransaction.DepositTransactionAccount({
            createdBy: contributionInput.createdBy,
            amount: fdaccount.fdamount,
            customerId:customerAccount.customerId,
            balance: 0,
            branchId: fdaccount.branchId,
            accountManagerId: fdaccount.accountManagerId,
            accountNumber: fdaccount.accountNumber,
            accountTypeId: FDAccountId,
            date: formattedDate,
            package:"FD",
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
            status:'inActive'
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

    const balance = fdaccount.totalAmount - fdaccount.expenseInterest
    const charge = fdaccount.chargeInterest
    const balanceAfterCharge = balance  - charge
      
        if (contributionInput.fdamount > balanceAfterCharge) {
          throw new Error("Insuffitient balance");
        }
      
        // Retrieve and update ledger balance
        const account = await Account.findOne({ accountNumber: fdaccount.accountNumber });
      
        if (!account) {
          throw new Error('Account not found for ledger update');
        }
        const newBalance = balanceAfterCharge - contributionInput.fdamount;
        const amountFromLedgerBalance = contributionInput.fdamount + charge
          const newContribution1 = await AccountTransaction.DepositTransactionAccount({
            createdBy: contributionInput.createdBy,
            amount: charge,
            customerId:customerAccount.customerId,
            balance: balanceAfterCharge,
            branchId: fdaccount.branchId,
            accountManagerId: fdaccount.accountManagerId,
            accountNumber: fdaccount.accountNumber,
            accountTypeId: FDAccountId,
            date: formattedDate,
            package:"FD",
            narration: "Interest Charge",
            direction: "Debit",
          });
          const newContribution = await AccountTransaction.DepositTransactionAccount({
            createdBy: contributionInput.createdBy,
            amount: contributionInput.fdamount,
            customerId:customerAccount.customerId,
            balance: 0,
            branchId: fdaccount.branchId,
            accountManagerId: fdaccount.accountManagerId,
            accountNumber: fdaccount.accountNumber,
            accountTypeId: FDAccountId,
            date: formattedDate,
            package:"FD",
            narration: "Withdrawal",
            direction: "Debit",
          });
              await AccountTransaction.DepositTransactionAccount({
                  createdBy: contributionInput.createdBy,
                  customerId:customerAccount.customerId,
                  amount:  newBalance,
                  balance: account.availableBalance + newBalance,
                  branchId: account.branchId,
                  accountManagerId: account.accountManagerId,
                  accountNumber: account.accountNumber,
                  accountTypeId: account._id,
                  date: formattedDate,
                  package:"FDTRANSFER",
                  narration: "From FD account",
                  direction: "Credit",
                });
      
          await Account.findOneAndUpdate(
            { accountNumber: fdaccount.accountNumber },
            {
              $set: {
                ledgerBalance: account.ledgerBalance - amountFromLedgerBalance,
                availableBalance: account.availableBalance + newBalance,
              },
            }
          );
      
          await FDAccount.findByIdAndUpdate(FDAccountId, {
            totalAmount: 0,
            status:'inActive'
          });
          const sureBankDeposit = {
            package:"FD",
             date: formattedDate,
             direction: "Credit",
             narration: "FD Charge Income",
             branchId: account.branchId,
             amount: charge - fdaccount.expenseInterest,
             customerId:customerAccount.customerId,
             type:account._id
           }
      
           await SureBankAccount.DepositTransactionAccount({...sureBankDeposit});
           const fdStatement = {
            customerId:customerAccount.customerId,
            accountNumber: account.accountNumber,
            FDAccountNumber:fdaccount.FDAccountNumber,
            branchId: account.branchId,
            incomeInterest:0,
            expenseInterest:fdaccount.expenseInterest,
            charge,
            profit: charge - fdaccount.expenseInterest
          }
          const fdincomestatement = new FDStatement(fdStatement);
          await fdincomestatement.save();
          return { data:newContribution, message:"Withdrawal successful" };
        }
        const updateFDAccountAmount = async (details) => {
          try {
            const {
              FDAccountNumber,
              fdamount,
              maturityDate,
              durationMonths,
              editedBy,
              startDate,
            } = details;
        
            // Validate input
            if (
              !FDAccountNumber ||
              !fdamount ||
              typeof fdamount !== "number" ||
              fdamount < 1000
            ) {
              throw new Error("Invalid account number or amount. Amount must be at least 1000.");
            }
        
            // Fetch FD account and main account
            const fdaccount = await FDAccount.findOne({ FDAccountNumber });
            const account = await Account.findOne({ accountNumber: fdaccount.accountNumber });
        
            if (!fdaccount || !account) {
              throw new Error("FDAccount or related main Account not found.");
            }
        
            if (fdaccount.totalAmount !== 0) {
              throw new Error("You cannot edit the amount while the package is running.");
            }
        
            // Fetch interest rates
            const interestData = await Interest.findOne();
            if (!interestData) {
              throw new Error("Interest configuration not found.");
            }
        
            const { expenseInterestRate, incomeInterestRate, chargeInterestRate } = interestData;
        
            // Compute interest and total
            const chargeInterest = (fdamount * chargeInterestRate * durationMonths) / (12 * 100);
            const expenseInterest = (fdamount * expenseInterestRate * durationMonths) / (12 * 100);
            const incomeInterest = (fdamount * incomeInterestRate * durationMonths) / (12 * 100);
            const totalAmount = fdamount + expenseInterest;
        
            // Update FD Account
            const updatedFDAccount = await FDAccount.findOneAndUpdate(
              { FDAccountNumber },
              {
                $set: {
                  fdamount,
                  totalAmount,
                  maturityDate,
                  startDate,
                  editedBy,
                  status: "Active",
                  expenseInterest,
                  incomeInterest,
                  chargeInterest,
                  expenseInterestRate,
                  incomeInterestRate,
                  chargeInterestRate,
                },
              },
              { new: true }
            );
        
            if (!updatedFDAccount) {
              throw new Error("FDAccount update failed.");
            }
        
            // Record FD deposit transaction
            await AccountTransaction.DepositTransactionAccount({
              createdBy: editedBy,
              customerId: fdaccount.customerId,
              amount: fdamount,
              balance: totalAmount,
              branchId: fdaccount.branchId,
              accountManagerId: fdaccount.accountManagerId,
              accountNumber: fdaccount.accountNumber,
              accountTypeId: fdaccount._id,
              date: startDate,
              package: "FD",
              narration: "Deposit",
              direction: "Credit",
            });
        
            // Update main account ledger balance
            const updatedLedgerBalance = account.ledgerBalance + totalAmount;
            await Account.findOneAndUpdate(
              { accountNumber: fdaccount.accountNumber },
              {
                $set: {
                  ledgerBalance: updatedLedgerBalance,
                },
              }
            );
        
            // Record interest as debit in FD account
            await AccountTransaction.DepositTransactionAccount({
              createdBy: editedBy,
              amount: expenseInterest,
              customerId: fdaccount.customerId,
              balance: totalAmount - expenseInterest,
              branchId: fdaccount.branchId,
              accountManagerId: fdaccount.accountManagerId,
              accountNumber: fdaccount.accountNumber,
              accountTypeId: fdaccount._id,
              date: startDate,
              package: "FD",
              narration: "Interest",
              direction: "Debit",
            });
        
            // Credit interest to main account
            await AccountTransaction.DepositTransactionAccount({
              createdBy: editedBy,
              customerId: fdaccount.customerId,
              amount: expenseInterest,
              balance: account.availableBalance + expenseInterest,
              branchId: account.branchId,
              accountManagerId: account.accountManagerId,
              accountNumber: account.accountNumber,
              accountTypeId: account._id,
              date: startDate,
              package: "FD",
              narration: "From FD account",
              direction: "Credit",
            });
        
            // Update available balance in main account
            await Account.findOneAndUpdate(
              { accountNumber: fdaccount.accountNumber },
              {
                $set: {
                  availableBalance: account.availableBalance + expenseInterest,
                },
              }
            );
        
            return {
              success: true,
              message: "FD amount and interest updated successfully.",
              updatedFDAccount,
            };
          } catch (error) {
            console.error("FD update error:", error);
            return {
              success: false,
              message: `An error occurred while updating the account: ${error.message}`,
            };
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
    updateFDAccountAmount,
    createInterest,
    getInterest,
    updateInterest,
    getFDStatement
  };