const SBAccountService = require('../Service/index');
require('dotenv').config()


    const createSBAccount = async (req, res) => {
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
        const status = 'booked';
          const { accountNumber,productName,productDescription, sellingPrice, accountManagerId } = req.body;
          const newSBAccount = await SBAccountService.createSBAccount({ accountNumber,productName,productDescription, sellingPrice,createdBy,startDate,status,accountManagerId });
          res.status(201).json({ message: newSBAccount.message, DSBccount: newSBAccount.newSBAccount });
        } catch (error) {
          res.status(500).json({ message: 'Server error', error: error.message });
        }
      };
      const updateSBAccountAmount = async (req,res) => {
        const editedBy = req.staff.staffId;
        const {SBAccountNumber,sellingPrice,productName} = req.body
        try {
      
      const newData = await SBAccountService.updateSBAccountAmount({SBAccountNumber,sellingPrice,productName,editedBy})
          res.status(201).json({ data: newData });
        } catch (error) {
          return { success: false, message: 'An error occurred while updating the amount', error };
        }
      };
      const updateCostPrice = async (req,res) => {
        const editedBy = req.staff.staffId;
        const {SBAccountNumber,costPrice,productName} = req.body
        try {
      
      const newData = await SBAccountService.updateCostPrice({SBAccountNumber,costPrice,productName,editedBy})
          res.status(201).json({ message:newData.message });
        } catch (error) {
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
      const getCustomerSBAccountById = async (req, res) => {
        try {
          const customerId = req.params.id
            const SBAccounts = await SBAccountService.getCustomerSBAccountById(customerId);
            res.status(200).json(SBAccounts);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      
      const saveSBContribution = async (req, res) => {
        try{
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await SBAccountService.saveSBContribution({ ...contributionInput, createdBy});
        res.status(200).json({data:result.data,message:result.message});
      }catch(error){
        res.status(500).json({ message: error.message });
      }
    }
      const withdrawSBContribution = async (req, res) => {
        try{
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await SBAccountService.withdrawSBContribution({ ...contributionInput, createdBy});
        res.status(200).json({data:result.data,message:result.message});
      }catch(error){
        res.status(500).json({ message: error.message });
      }
    }
      const sellProduct = async (req, res) => {
        try{
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await SBAccountService.sellProduct({ ...contributionInput, createdBy});
        res.status(200).json({data:result.data,message:result.message});
      }catch(error){
        res.status(500).json({ message: error.message });
      }
    }

  module.exports = {
    createSBAccount,
    getDSAccount,
    saveSBContribution,
    getCustomerSBAccountById,
    updateSBAccountAmount,
    withdrawSBContribution,
    sellProduct,
    updateCostPrice
  };