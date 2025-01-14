const Account = require('../../Account/Model');
const SureBankAccount = require('../Model/index');

const DepositTransactionAccount = async (SureBankAccountDepositData) => {
    
  const transaction = new SureBankAccount({...SureBankAccountDepositData});
  const newTransaction = await transaction.save();
  return ({newTransaction})
};
const getDSAccountByAccountNumber = async (accountNumber) => {
    return await Account.findOne({ accountNumber });
  };

  module.exports = {
    DepositTransactionAccount,
    getDSAccountByAccountNumber,

  };