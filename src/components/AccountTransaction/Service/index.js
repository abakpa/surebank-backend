const mongoose = require('mongoose');
const Account = require('../../Account/Model');
const AccountTransaction = require('../Model/index');
const Staff = require('../../Staff/Model');
const Customer = require('../../Customer/Model');

const DepositTransactionAccount = async (DSAccountDepositData) => {
    
  const transaction = new AccountTransaction({...DSAccountDepositData});
  const newTransaction = await transaction.save();
  return ({newTransaction})
};

const attachCreatedByNames = async (transactions) => {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return transactions;
  }

  const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
  const creatorIds = [
    ...new Set(
      transactions
        .map((transaction) => transaction.createdBy)
        .filter((value) => value && isValidObjectId(value))
    )
  ];
  const customerIds = [
    ...new Set(
      transactions
        .map((transaction) => transaction.customerId)
        .filter((value) => value && isValidObjectId(value))
    )
  ];

  const [staffs, customers] = await Promise.all([
    Staff.find({ _id: { $in: creatorIds } }).select('_id firstName lastName').lean(),
    Customer.find({ _id: { $in: customerIds } }).select('_id firstName lastName').lean()
  ]);

  const staffMap = new Map(
    staffs.map((staff) => [staff._id.toString(), `${staff.firstName} ${staff.lastName}`.trim()])
  );
  const customerMap = new Map(
    customers.map((customer) => [customer._id.toString(), `${customer.firstName} ${customer.lastName}`.trim()])
  );

  return transactions.map((transaction) => {
    const rawTransaction = typeof transaction.toObject === 'function' ? transaction.toObject() : transaction;
    const isCustomerPostedTransaction =
      rawTransaction.createdBy === rawTransaction.customerId
      || ['ECOMMERCE_SYSTEM', 'PAYSTACK_WALLET'].includes(rawTransaction.createdBy);

    const createdByName = staffMap.get(rawTransaction.createdBy)
      || (isCustomerPostedTransaction ? customerMap.get(rawTransaction.customerId) : customerMap.get(rawTransaction.createdBy))
      || rawTransaction.createdBy;

    return {
      ...rawTransaction,
      createdByName,
    };
  });
};

const getDSAccountByAccountNumber = async (accountNumber) => {
    return await Account.findOne({ accountNumber });
  };

  const getCustomerAcountTransactionById = async (accountTypeId) =>{
    try {
        const transactions = await AccountTransaction.find({accountTypeId:accountTypeId}).sort({ createdAt: -1 });
        return await attachCreatedByNames(transactions);
    } catch (error) {
        throw error;
    }
  }
  const getTransaction = async () =>{
    try {
        const transactions = await AccountTransaction.find({}).sort({ createdAt: -1 });
        return await attachCreatedByNames(transactions);
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
