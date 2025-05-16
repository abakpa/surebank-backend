const DSAccountService = require('../Service/index');
require('dotenv').config()


    const createDSAccount = async (req, res) => {
        try {
        const createdBy = req.staff.staffId;
        const currentDate = new Date();
        const startDate = currentDate.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "2-digit", // Abbreviated year (YY)
          hour: "2-digit",
          minute: "2-digit",
          hour12: true, // Ensures AM/PM format
        });
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
        const editedBy = req.staff.staffId;
        const {DSAccountNumber,amountPerDay} = req.body
        try {
      
      const newAmountPerDay = await DSAccountService.updateDSAccountAmount({DSAccountNumber,amountPerDay,editedBy})
          res.status(201).json({ data: newAmountPerDay });
        } catch (error) {
          console.error('Error updating DSAccount amount:', error);
          res.status(500).json({ message: error.message });
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
        try{
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await DSAccountService.saveDailyContribution({ ...contributionInput, createdBy});
        res.status(200).json({data:result.data,message:result.message});
      }catch(error){
        res.status(500).json({ message: error.message });
      }
    }
      const withdrawDailyContribution = async (req, res) => {
        try{
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await DSAccountService.withdrawDailyContribution({ ...contributionInput, createdBy});
        res.status(200).json({data:result,message:'Withdrawal successful'});
      }catch(error){
        res.status(500).json({ message: error.message });
      }
    }
      const mainWithdrawal = async (req, res) => {
        try{
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await DSAccountService.mainWithdrawal({ ...contributionInput, createdBy});
        res.status(200).json({data:result,message:'Withdrawal successful'});
      }catch(error){
        res.status(500).json({ message: error.message });
      }
    }

  module.exports = {
    createDSAccount,
    getDSAccount,
    saveDailyContribution,
    getCustomerDSAccountById,
    updateDSAccountAmount,
    withdrawDailyContribution,
    mainWithdrawal
  };