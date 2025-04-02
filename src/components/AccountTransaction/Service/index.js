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

  const getCustomerAcountTransactionById = async (accountTypeId) =>{
    try {
        return await AccountTransaction.find({accountTypeId:accountTypeId});
    } catch (error) {
        throw error;
    }
  }
  const getTransaction = async () =>{
    try {
        return await AccountTransaction.find({});
    } catch (error) {
        throw error;
    }
  }
  module.exports = {
    DepositTransactionAccount,
    getDSAccountByAccountNumber,
    getCustomerAcountTransactionById,
    getTransaction

  };