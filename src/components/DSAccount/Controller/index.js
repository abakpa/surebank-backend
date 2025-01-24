const DSAccountService = require('../Service/index');
require('dotenv').config()


    const createDSAccount = async (req, res) => {
        try {
        const createdBy = req.staff.staffId;
        const startDate = new Date().getTime();
        const status = 'open';
        const hasBeenCharged = "false"
          const { accountNumber, amountPerDay, accountManagerId,accountType } = req.body;
          const newDSAccount = await DSAccountService.createDSAccount({ accountNumber,amountPerDay,createdBy,startDate,status,accountManagerId,hasBeenCharged, accountType });
          res.status(201).json({ message: newDSAccount.message, DSAccount: newDSAccount.newDSAccount });
        } catch (error) {
          res.status(500).json({ message: 'Server error', error: error.message });
        }
      };
      const updateDSAccountAmount = async (req,res) => {
        const {DSAccountNumber,amountPerDay} = req.body
        try {
      
      const newAmountPerDay = await DSAccountService.updateDSAccountAmount({DSAccountNumber,amountPerDay})
          res.status(201).json({ data: newAmountPerDay });
        } catch (error) {
          console.error('Error updating DSAccount amount:', error);
          return { success: false, message: 'An error occurred while updating the amount', error };
        }
      };
      
      const getDSAccount = async (req, res) => {
        try {
            const DSAccounts = await DSAccountService.getDSAccounts();
            res.status(200).json(DSAccounts);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getCustomerDSAccountById = async (req, res) => {
        try {
          const customerId = req.params.id
            const DSAccounts = await DSAccountService.getCustomerDSAccountById(customerId);
            res.status(200).json(DSAccounts);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const saveDailyContribution = async (req, res) => {
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await DSAccountService.saveDailyContribution({ ...contributionInput, createdBy});
        res.status(200).json(result);
      };

  module.exports = {
    createDSAccount,
    getDSAccount,
    saveDailyContribution,
    getCustomerDSAccountById,
    updateDSAccountAmount
  };