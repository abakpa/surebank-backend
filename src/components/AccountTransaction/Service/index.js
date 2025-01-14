const Account = require('../../Account/Model');
const AccountTransaction = require('../Model/index');

const DepositTransactionAccount = async (DSAccountDepositData) => {
    
  const transaction = new AccountTransaction({...DSAccountDepositData});
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