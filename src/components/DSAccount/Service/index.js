const Account = require('../../Account/Model');
const  generateUniqueAccountNumber  = require('../../generateAccountNumber');
const DSAccount = require('../Model/index');
const AccountTransaction = require('../../AccountTransaction/Service/index');
const SureBankAccount = require('../../SureBankAccount/Service/index')

const createDSAccount = async (DSAccountData) => {
          const existingDSAccountNumber = await getAccountByAccountNumber(DSAccountData.accountNumber);
          if (!existingDSAccountNumber) {
            throw new Error('Account number does not exists');
          }
          const existingDSAccount = await DSAccount.findOne({
            accountNumber: DSAccountData.accountNumber,
            accountType: DSAccountData.accountType,
});
          if (existingDSAccount) {
            throw new Error(`Customer has an active ${DSAccountData.accountType} DS account running`);
          }
          const DSAccountNumber = await generateUniqueAccountNumber('DSA')
  const dsaccount = new DSAccount({...DSAccountData,customerId:existingDSAccountNumber.customerId,branchId:existingDSAccountNumber.branchId,DSAccountNumber});
  const newDSAccount = await dsaccount.save();
  return ({message:"Account created successfilly", newDSAccount})
};
const updateDSAccountAmount = async (details) => {
  const {DSAccountNumber,amountPerDay,editedBy} = details
  try {
    // Validate input
    if (!DSAccountNumber || !amountPerDay || typeof amountPerDay !== 'number' || amountPerDay <= 0) {
      throw new Error('Invalid account number or amount');
    }

    const dsaccount = await DSAccount.findOne({
      DSAccountNumber: DSAccountNumber,
      // accountType: contributionInput.accountType,
    });
    if (dsaccount.totalContribution !==0 && dsaccount.totalCount !==0) {
      throw new Error('You cannot edit amount while package is running');
    }
    // Find and update the DSAccount by DSAccount
    const updatedDSAccount = await DSAccount.findOneAndUpdate(
      { DSAccountNumber }, // Find the account by accountNumber
      { $set: { amountPerDay: amountPerDay, editedBy:editedBy } }, // Update only the amount field
      { new: true } // Return the updated document
    );

    // Check if the account was found and updated
    if (!updatedDSAccount) {
      throw new Error('DSAccount not found or update failed');
    }

    return { success: true, message: 'Amount updated successfully', updatedDSAccount };
  } catch (error) {
    throw new Error('An error occurred while updating the amount', error );
  }
};
const getAccountByAccountNumber = async (accountNumber) => {
    return await Account.findOne({ accountNumber });
  };

const getDSAccounts = async () =>{
    try {
        return await DSAccount.find({});
    } catch (error) {
        throw error;
    }
  }
const getCustomerDSAccountById = async (customerId) =>{
    try {
        return await DSAccount.find({customerId:customerId});
    } catch (error) {
        throw error;
    }
  }

  const saveDailyContribution = async (contributionInput) => {
    // Retrieve customer account using the DS account number
    const customerAccount = await getDSAccountByAccountNumber(contributionInput.DSAccountNumber);
    if (!customerAccount) {
      throw new Error  ('Account number does not exist.');
    }
  
    // Check for an active package with the given account type
    const dsaccount = await DSAccount.findOne({
      DSAccountNumber: contributionInput.DSAccountNumber,
      accountType: contributionInput.accountType,
    });
  
    if (!dsaccount) {
      throw new error('Customer does not have an active package');
    }
  
    // Validate contribution amount against the daily savings package
    if (contributionInput.amountPerDay % dsaccount.amountPerDay !== 0) {
      throw new Error(`Amount is not valid for ${dsaccount.amountPerDay} daily savings package`);
    }
  
    const DSAccountId = dsaccount._id;
    const contributionDaysCount = contributionInput.amountPerDay / dsaccount.amountPerDay;
    const currentDate = new Date().getTime();
    const formattedDate = new Date(currentDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  
    if (contributionInput.amountPerDay < dsaccount.amountPerDay) {
      throw new Error(`Amount cannot be less than ${dsaccount.amountPerDay}`);
    }
  
    if (dsaccount.status === 'closed') {
      throw new Error('This account has been closed');
    }

        // Retrieve and update ledger balance
        const updateLedgerBalance = await Account.findOne({ accountNumber: dsaccount.accountNumber });
  
        if (!updateLedgerBalance) {
          throw new Error('Account not found for ledger update');
        }
  
    // Calculate the new total count
    const totalCount = dsaccount.totalCount + contributionDaysCount;
  
    if (totalCount > 31) {
      const circle = dsaccount.totalContribution + contributionInput.amountPerDay;

      const numberOfCircleBy31 = totalCount/31

      const perfectCircle = Math.floor(numberOfCircleBy31);

      const count = 31 * perfectCircle;

      const excessCount = totalCount - count;
      
      let charge;
      if (dsaccount.hasBeenCharged === 'true') {
        charge = (numberOfCircleBy31 % 31 !== 0) 
          ? perfectCircle * dsaccount.amountPerDay 
          : perfectCircle * dsaccount.amountPerDay - dsaccount.amountPerDay;
      } else {
        charge = (numberOfCircleBy31 % 31 !== 0) 
          ? (perfectCircle + 1) * dsaccount.amountPerDay
          : perfectCircle * dsaccount.amountPerDay;
      }
      const countAmount = count * dsaccount.amountPerDay
        let totalContribution
        if(dsaccount.hasBeenCharged === 'true'){
      totalContribution = countAmount - charge;
        }else{
      totalContribution = (countAmount + dsaccount.amountPerDay) - charge;
        }

      let excessBalance
      if(dsaccount.hasBeenCharged === 'false'){
      excessBalance = circle - ((countAmount + dsaccount.amountPerDay)-charge);
      }else{
      excessBalance = circle - (countAmount - charge);
      }
    
      const account = await Account.findOne({ accountNumber: dsaccount.accountNumber });
      
      await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: contributionInput.amountPerDay,
        balance: dsaccount.totalContribution + contributionInput.amountPerDay,
        branchId: dsaccount.branchId,
        accountManagerId: dsaccount.accountManagerId,
        accountNumber: dsaccount.accountNumber,
        accountTypeId: DSAccountId,
        date: formattedDate,
        narration: "DS Deposit",
        direction: "Credit",
      });
    
      await AccountTransaction.DepositTransactionAccount({
        accountNumber: dsaccount.accountNumber,
        amount: totalContribution,
        balance: excessBalance,
        createdBy: dsaccount.createdBy,
        narration: "Total DS",
        accountTypeId: DSAccountId,
        accountManagerId: dsaccount.accountManagerId,
        branchId: dsaccount.branchId,
        date: formattedDate,
        direction: "Debit",
      });
    
      await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: totalContribution,
        balance: account.availableBalance + totalContribution,
        branchId: account.branchId,
        accountManagerId: account.accountManagerId,
        accountNumber: account.accountNumber,
        accountTypeId: account._id,
        date: formattedDate,
        narration: "From DS account",
        direction: "Credit",
      });
    
      await Account.findOneAndUpdate(
        { accountNumber: dsaccount.accountNumber },
        {
          $set: {
            availableBalance: updateLedgerBalance.availableBalance + totalContribution,
            ledgerBalance: updateLedgerBalance.ledgerBalance + (contributionInput.amountPerDay - charge)
          },
        }
      );
    
      const newContribution = await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: charge,
        balance: excessBalance - charge,
        branchId: dsaccount.branchId,
        accountManagerId: dsaccount.accountManagerId,
        accountNumber: dsaccount.accountNumber,
        accountTypeId: DSAccountId,
        date: formattedDate,
        narration: "DS Charge",
        direction: "Debit",
      });
    
      const sureBankDeposit = {
        date: formattedDate,
        direction: "Credit",
        narration: "DS Charge",
        branchId: dsaccount.branchId,
        amount: charge,
        customerId: dsaccount.customerId,
        type: DSAccountId,
      };
    
      await SureBankAccount.DepositTransactionAccount({ ...sureBankDeposit });
    
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        hasBeenCharged: 'true',
        totalContribution: excessBalance - charge,
        totalCount: excessCount,
      });
    
      return { data: newContribution, message: "Contribution successful" };
    }
  


    if (totalCount === 31) {
      const chargeAmount = dsaccount.amountPerDay;
      const account = await Account.findOne({ accountNumber: dsaccount.accountNumber });
      await AccountTransaction.DepositTransactionAccount({
       createdBy: contributionInput.createdBy,
       amount: contributionInput.amountPerDay,
       balance: dsaccount.totalContribution + contributionInput.amountPerDay,
       branchId: dsaccount.branchId,
       accountManagerId: dsaccount.accountManagerId,
       accountNumber: dsaccount.accountNumber,
       accountTypeId: DSAccountId,
       date: formattedDate,
       narration: "DS Deposit",
       direction: "Credit",
     });
      const finalContribution = await AccountTransaction.DepositTransactionAccount({
        accountNumber: dsaccount.accountNumber,
        amount: dsaccount.totalContribution + contributionInput.amountPerDay,
        balance: 0,
        createdBy: dsaccount.createdBy,
        narration: "Total DS",
        accountTypeId: DSAccountId,
        accountManagerId: dsaccount.accountManagerId,
        branchId: dsaccount.branchId,
        date: formattedDate,
        direction: "Debit",
      });
      const toAvailableBalance = await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount:  dsaccount.totalContribution + contributionInput.amountPerDay,
        balance: account.availableBalance + dsaccount.totalContribution + contributionInput.amountPerDay,
        branchId: account.branchId,
        accountManagerId: account.accountManagerId,
        accountNumber: account.accountNumber,
        accountTypeId: account._id,
        date: formattedDate,
        narration: "From DS account",
        direction: "Credit",
      });
  
      await Account.findOneAndUpdate(
        { accountNumber: dsaccount.accountNumber },
        {
          $set: {
            availableBalance: updateLedgerBalance.availableBalance + dsaccount.totalContribution + contributionInput.amountPerDay,
            ledgerBalance: updateLedgerBalance.ledgerBalance + contributionInput.amountPerDay,
          },
        }
      );
  
      // Close the package and reset contribution data
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        hasBeenCharged: 'false',
        totalContribution: 0,
        totalCount: 0,
      });
  
      return { finalContribution };
    }
  
    if (dsaccount.hasBeenCharged === 'true') {
      await Account.findOneAndUpdate(
        { accountNumber: dsaccount.accountNumber },
        {
          $set: {
            ledgerBalance: updateLedgerBalance.ledgerBalance + contributionInput.amountPerDay,
          },
        }
      );
  
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        totalContribution: dsaccount.totalContribution + contributionInput.amountPerDay,
      });
  
      const newContribution = await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: contributionInput.amountPerDay,
        balance: dsaccount.totalContribution + contributionInput.amountPerDay,
        branchId: dsaccount.branchId,
        accountManagerId: dsaccount.accountManagerId,
        accountNumber: dsaccount.accountNumber,
        accountTypeId: DSAccountId,
        date: formattedDate,
        narration: "DS Deposit",
        direction: "Credit",
      });
      // Update total contribution count
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        $set: { totalCount },
      });
  
      return { data:newContribution, message:"Contribution successfull" };
    }
  
    if (dsaccount.hasBeenCharged === 'false') {
      const chargeAmount = dsaccount.amountPerDay;

       await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: contributionInput.amountPerDay,
        balance: dsaccount.totalContribution + contributionInput.amountPerDay,
        branchId: dsaccount.branchId,
        accountManagerId: dsaccount.accountManagerId,
        accountNumber: dsaccount.accountNumber,
        accountTypeId: DSAccountId,
        date: formattedDate,
        narration: "DS Deposit",
        direction: "Credit",
      });
  
      // Log the charge as a new contribution
      const newContribution = await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: chargeAmount,
        balance: contributionInput.amountPerDay - chargeAmount,
        branchId: dsaccount.branchId,
        accountManagerId: dsaccount.accountManagerId,
        accountNumber: dsaccount.accountNumber,
        accountTypeId: DSAccountId,
        date: formattedDate,
        narration: "DS Charge",
        direction: "Debit",
      });
      const newBalance = contributionInput.amountPerDay - chargeAmount
      const sureBankDeposit = {
        date: formattedDate,
        direction: "Credit",
        narration: "DS Charge",
        branchId: dsaccount.branchId,
        amount: chargeAmount,
        customerId:dsaccount.customerId,
        type:DSAccountId
      }

      await SureBankAccount.DepositTransactionAccount({...sureBankDeposit});
  
      await Account.findOneAndUpdate(
        { accountNumber: dsaccount.accountNumber },
        {
          $set: {
            ledgerBalance: updateLedgerBalance.ledgerBalance + newBalance,
          },
        }
      );
  
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        hasBeenCharged: "true",
        totalContribution: contributionInput.amountPerDay - chargeAmount,
      });
      // Update total contribution count
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        $set: { totalCount },
      });
  
      return { data:newContribution, message:"Contribution successfull" };
    }
  
    return { message: "Contribution processed successfully" };
  };
  
  const withdrawDailyContribution = async (contributionInput) => {
    // Retrieve customer account using the DS account number
    const customerAccount = await getDSAccountByAccountNumber(contributionInput.DSAccountNumber);
    if (!customerAccount) {
      throw new Error('Account number does not exist.');
    }
  
    // Check for an active package with the given account type
    const dsaccount = await DSAccount.findOne({
      DSAccountNumber: contributionInput.DSAccountNumber,
      accountType: contributionInput.accountType,
    });
  
    if (!dsaccount) {
      throw new Error('Customer does not have an active package');
    }
  
    const DSAccountId = dsaccount._id;
    const currentDate = new Date().getTime();
    const formattedDate = new Date(currentDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  
    if (contributionInput.amountPerDay > dsaccount.totalContribution) {
      throw new Error("Insuffitient balance");
    }
  
    // Retrieve and update ledger balance
    const account = await Account.findOne({ accountNumber: dsaccount.accountNumber });
  
    if (!account) {
      throw new Error('Account not found for ledger update');
    }
    const newBalance = dsaccount.totalContribution - contributionInput.amountPerDay;
  
      const newContribution = await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: contributionInput.amountPerDay,
        balance: 0,
        branchId: dsaccount.branchId,
        accountManagerId: dsaccount.accountManagerId,
        accountNumber: dsaccount.accountNumber,
        accountTypeId: DSAccountId,
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
        narration: "From DS account",
        direction: "Credit",
      });
  
      await Account.findOneAndUpdate(
        { accountNumber: dsaccount.accountNumber },
        {
          $set: {
            availableBalance: account.availableBalance + newBalance,
            ledgerBalance: account.ledgerBalance - contributionInput.amountPerDay,
          },
        }
      );
  
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        hasBeenCharged: 'false',
        totalContribution: 0,
        totalCount: 0,
      });
  
      return { newContribution };
    }
  const mainWithdrawal = async (contributionInput) => {
    // Retrieve customer account using the DS account number
    const customerAccount = await getAccountByAccountNumber(contributionInput.accountNumber);
    if (!customerAccount) {
      throw new Error('Account number does not exist.');
    }
  
    const currentDate = new Date().getTime();
    const formattedDate = new Date(currentDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const account = await Account.findOne({ accountNumber: contributionInput.accountNumber });
  
    if (contributionInput.amountPerDay > account.availableBalance) {
      throw new Error("Insuffitient balance");
    }
  
  
    // Retrieve and update ledger balance
    const updateLedgerBalance = await Account.findOne({ accountNumber: contributionInput.accountNumber });
  
    if (!updateLedgerBalance) {
      throw new Error('Account not found for ledger update');
    }
  
      const newContribution = await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: contributionInput.amountPerDay,
        balance: account.availableBalance - contributionInput.amountPerDay,
        branchId: account.branchId,
        accountManagerId: account.accountManagerId,
        accountNumber: account.accountNumber,
        accountTypeId: account._id,
        date: formattedDate,
        narration: "Withdrawal",
        direction: "Debit",
      });
      // const newBalance = dsaccount.totalContribution - contributionInput.amountPerDay;
  
      await Account.findOneAndUpdate(
        { accountNumber: contributionInput.accountNumber },
        {
          $set: {
            availableBalance: updateLedgerBalance.availableBalance - contributionInput.amountPerDay ,
            ledgerBalance: updateLedgerBalance.ledgerBalance - contributionInput.amountPerDay,
          },
        }
      );
  
      return { newContribution };
    }
 

  

  const getDSAccountByAccountNumber = async (DSAccountNumber) => {
    return await DSAccount.findOne({ DSAccountNumber:DSAccountNumber });
  };

  module.exports = {
    createDSAccount,
    getDSAccountByAccountNumber,
    getDSAccounts,
    saveDailyContribution,
    getCustomerDSAccountById,
    updateDSAccountAmount,
    withdrawDailyContribution,
    mainWithdrawal
  };