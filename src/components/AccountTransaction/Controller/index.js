const accountTransactionService = require('../Service/index');
require('dotenv').config()
const bcrypt = require('bcrypt')


 
      const getAccountTransaction = async (req, res) => {
        try {
            const customers = await accountTransactionService.getCustomers();
            res.status(200).json(customers);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getCustomerAcountTransactionById = async (req, res) => {
        try {
          const accountTypeId = req.params.id
            const accountTransaction = await accountTransactionService.getCustomerAcountTransactionById(accountTypeId);
            res.status(200).json(accountTransaction);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }

  module.exports = {
    getAccountTransaction,
    getCustomerAcountTransactionById
  };