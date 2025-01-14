const DSAccountService = require('../Service/index');
require('dotenv').config()


    const createDSAccount = async (req, res) => {
        try {
        const createdBy = req.staff.staffId;
        const startDate = new Date().getTime();
        const status = 'open';
        const hasBeenCharged = "false"
          const { accountNumber, amountPerDay, accountManagerId } = req.body;
          const newDSAccount = await DSAccountService.createDSAccount({ accountNumber,amountPerDay,createdBy,startDate,status,accountManagerId,hasBeenCharged });
          res.status(201).json({ message: newDSAccount.message, DSAccount: newDSAccount.newDSAccount });
        } catch (error) {
          res.status(500).json({ message: 'Server error', error: error.message });
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
    getCustomerDSAccountById
  };