const Account = require('../../Account/Model');
const  generateUniqueAccountNumber  = require('../../generateAccountNumber');
const DSAccount = require('../Model/index');
const AccountTransaction = require('../../AccountTransaction/Service/index');
const SureBankAccount = require('../../SureBankAccount/Service/index')

const createDSAccount = async (DSAccountData) => {
          const existingDSAccountNumber = await getAccountByAccountNumber(DSAccountData.accountNumber);
          if (!existingDSAccountNumber) {
            return ({ message: 'Account number does not exists' });
          }
          const existingDSAccount = await DSAccount.findOne({
            accountNumber: DSAccountData.accountNumber,
            accountType: DSAccountData.accountType,
});
          if (existingDSAccount) {
            return ({ message: `Customer has an active ${DSAccountData.accountType} DS account running` });
          }
          const DSAccountNumber = await generateUniqueAccountNumber('DSA')
  const dsaccount = new DSAccount({...DSAccountData,customerId:existingDSAccountNumber.customerId,branchId:existingDSAccountNumber.branchId,DSAccountNumber});
  const newDSAccount = await dsaccount.save();
  return ({message:"Account created successfilly", newDSAccount})
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
    // const PackageModel = await Package();
    // const ContributionModel = await Contribution();
    // const AccountModel = await Account();
    // const AccountTransactionModel = await AccountTransaction();
    const customerAccount = await getDSAccountByAccountNumber(contributionInput.DSAccountNumber);
    if (!customerAccount) {
      return 'Account number does not exist.';
    }
    const dsaccount = await DSAccount.findOne({
      DSAccountNumber: contributionInput.DSAccountNumber,
      accountType: contributionInput.accountType,
    });
  
    if (!dsaccount) {
      return 'Customer does not have an active package';
    }
  
    if (contributionInput.amountPerDay % dsaccount.amountPerDay !== 0) {
      return `Amount is not valid for ${dsaccount.amountPerDay} daily savings package`;
    }
  
    const DSAccountId = dsaccount._id;
    const contributionDaysCount = contributionInput.amountPerDay / dsaccount.amountPerDay;
    const currentDate = new Date().getTime();
  
    if (contributionInput.amountPerDay < dsaccount.amountPerDay) {
      return `Amount cannot be less than ${dsaccount.amountPerDay}`;
    }
  
    if (dsaccount.status === 'closed') {
    return 'This account has been closed';
    }
  
    // Calculate the new total count by adding contributionDaysCount to the existing value
    const totalCount = dsaccount.totalCount + contributionDaysCount;

  
    if (totalCount > 31) {
      return 'Total daily amount contribution cannot exceed 31';
    }
  
    // const branch = await AccountModel.findOne({ accountNumber: contributionInput.accountNumber });
  
    const formattedDate = new Date(currentDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    
    const newContribution = await AccountTransaction.DepositTransactionAccount({
      createdBy: contributionInput.createdBy,
      amount: contributionInput.amountPerDay,
      branchId: dsaccount.branchId,
      accountManagerId: dsaccount.accountManagerId,
      accountNumber: dsaccount.accountNumber,
      accountTypeId: DSAccountId,
      // count: contributionDaysCount,
      date: formattedDate, // Use the formatted date
      narration: "Daily contribution",
      direction: "Credit",
    });
    
    dsaccount.totalContribution += contributionInput.amountPerDay;
    const updateLedgerBalance = await Account.findOne({accountNumber:dsaccount.accountNumber})
    if (dsaccount.hasBeenCharged === 'true') {
    await Account.findOneAndUpdate(
        { accountNumber: dsaccount.accountNumber }, // Convert accountNumber into a query object
        {
          $set: { 
            ledgerBalance: updateLedgerBalance.ledgerBalance + contributionInput.amountPerDay, // Update ledger balance
          }
        }
      );
    }
    if (dsaccount.hasBeenCharged === 'false') {
      dsaccount.totalContribution -= dsaccount.amountPerDay;
      

      const newContribution = await AccountTransaction.DepositTransactionAccount({
        createdBy: contributionInput.createdBy,
        amount: dsaccount.amountPerDay,
        branchId: dsaccount.branchId,
        accountManagerId: dsaccount.accountManagerId,
        accountNumber: dsaccount.accountNumber,
        accountTypeId: DSAccountId,
        // count: contributionDaysCount,
        date: formattedDate, // Use the formatted date
        narration: "Contribution Charge",
        direction: "Debit",
      });
      await Account.findOneAndUpdate(
        { accountNumber: dsaccount.accountNumber }, // Convert accountNumber into a query object
        {
          $set: { 
            ledgerBalance: updateLedgerBalance.ledgerBalance + dsaccount.amountPerDay, // Update ledger balance
          }
        }
      );
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        hasBeenCharged: "true",
      });
  
      const addLedgerEntryInput = await SureBankAccount.DepositTransactionAccount({
        type: 'dsa',
        direction: 'credit',
        date: currentDate,
        narration: 'Daily contribution',
        amount: dsaccount.amountPerDay,
        customerId: dsaccount.customerId,
        branchId: dsaccount.branchId,
      });
    //   await addLedgerEntry(addLedgerEntryInput);
    }
  
    await DSAccount.findByIdAndUpdate(DSAccountId, {
      totalContribution: dsaccount.totalContribution,
    });
 
    // Update the total contribution count in the Package model
    await DSAccount.findByIdAndUpdate(DSAccountId, {
      $set: { totalCount }, // Update the totalCount field with the new value
    });
  
    if (totalCount === 31) {
      const depositDetail = await AccountTransaction.DepositTransactionAccount({
        accountNumber: dsaccount.accountNumber,
        amount: dsaccount.totalContribution,
        createdBy: dsaccount.createdBy,
        narration:'Total contribution',
        accountTypeId:DSAccountId,
        accountManagerId:dsaccount.accountManagerId,
        branchId:dsaccount.branchId,
        date:formattedDate,
        direction:'Debit'
      });

      await Account.findOneAndUpdate(
        { accountNumber: dsaccount.accountNumber }, // Convert accountNumber into a query object
        {
          $set: { 
            availableBalance: updateLedgerBalance.availableBalance + dsaccount.totalContribution, // Update ledger balance
          }
        }
      );
  
    //   await makeCustomerDeposit(depositDetail);
  
      // Close the package and reset total contribution count to 0
      await DSAccount.findByIdAndUpdate(DSAccountId, {
        hasBeenCharged: 'false',
        totalContribution: 0,
        totalCount: 0,
      });
    } else {
    //   const transactionDate = new Date().getTime();
  
    //   const contributionTransaction = await AccountTransaction.create({
    //     accountNumber: contributionInput.accountNumber,
    //     amount: contributionInput.amount,
    //     createdBy: contributionInput.createdBy,
    //     branchId: branch.branchId,
    //     date: transactionDate,
    //     direction: 'inflow',
    //     narration: "Daily contribution",
    //   });
  
      return { newContribution, };
    }
  };

  const getDSAccountByAccountNumber = async (DSAccountNumber) => {
    return await DSAccount.findOne({ DSAccountNumber:DSAccountNumber });
  };

  module.exports = {
    createDSAccount,
    getDSAccountByAccountNumber,
    getDSAccounts,
    saveDailyContribution,
    getCustomerDSAccountById
  };