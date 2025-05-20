const FDAccountService = require('../Service/index');

// const User = require("../models/User");

const createInterest = async (req, res) => {
    try {
        const Interest = await FDAccountService.createInterest(req.body);
        res.status(201).json(Interest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
const getInterest = async (req, res) => {
    try {
        const interest = await FDAccountService.getInterest();
        res.status(200).json(interest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
   const updateInterest = async (req,res) => {
        const editedBy = req.staff.staffId;
        const {expenseInterestRate,incomeInterestRate,chargeInterestRate} = req.body
        try {
      
      const newData = await FDAccountService.updateInterest({expenseInterestRate,incomeInterestRate,chargeInterestRate,editedBy})
          res.status(201).json({ data: newData });
        } catch (error) {
          return { success: false, message: 'An error occurred while updating', error };
        }
      };

// Create a fixed deposit
const createFDAccount = async (req, res) => {
  try {
    const { fdamount, durationMonths, accountNumber, accountManagerId } = req.body;
    const createdBy = req.staff.staffId;

    // Get current date
    const currentDate = new Date();
    const startDate = currentDate.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit", // Abbreviated year (YY)
      hour: "2-digit",
      minute: "2-digit",
      hour12: true, // Ensures AM/PM format
    });
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + durationMonths);

    const status = 'Active';

    // Check minimum deposit requirement
    if (fdamount < 1000) {
      return res.status(400).json({ message: "Minimum deposit is ₦1000" });
    }

    // Calculate maturity date with proper year adjustment
    // const maturityDate = new Date(currentDate);
    // const currentYear = maturityDate.getFullYear();
    // const currentMonth = maturityDate.getMonth();
    
    // Calculate new month and year
    // const totalMonths = currentMonth + durationMonths;
    // const newYear = currentYear + Math.floor(totalMonths / 12);
    // const newMonth = totalMonths % 12;
    
    // maturityDate.setFullYear(newYear, newMonth, maturityDate.getDate());

    // Handle cases where the original date was the last day of the month
    // if (maturityDate.getDate() !== currentDate.getDate()) {
    //   maturityDate.setDate(0); // Set to last day of previous month
    // }

    // Create FD account using service
    const fixDeposit = await FDAccountService.createFDAccount({
      createdBy,
      startDate,
      accountNumber,
      accountManagerId,
      fdamount,
      durationMonths,
      maturityDate,
      status,
    });

    res.status(201).json({
      message: fixDeposit.message,
      FDAccount: fixDeposit.newFDAccount,
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get user’s fixed deposits
const getFDAccount = async (req, res) => {
    try {
        const FDAccounts = await FDAccountService.getCustomerFDAccountById();
        res.status(200).json(FDAccounts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
  }
const getCustomerFDAccountById = async (req, res) => {
    try {
        const customerId = req.params.id
        const FDAccounts = await FDAccountService.getCustomerFDAccountById(customerId);
        res.status(200).json(FDAccounts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
  }

// Withdraw fixed deposit
      const withdrawImatureFixedDeposit = async (req, res) => {
        try{
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await FDAccountService.withdrawImatureFDContribution({ ...contributionInput, createdBy});
        res.status(200).json({data:result.data,message:result.message});
      }catch(error){
        res.status(500).json({ message: error.message });
      }
    }
    const withdrawFixedDeposit = async (req, res) => {
        try{
        const contributionInput = req.body;
        const createdBy = req.staff.staffId;
        // const packageId = req.query;
        const result = await FDAccountService.withdrawFDContribution({ ...contributionInput, createdBy});
        res.status(200).json({data:result.data,message:result.message});
      }catch(error){
        res.status(500).json({ message: error.message });
      }
    }
        const updateFDAccount = async (req,res) => {
            const editedBy = req.staff.staffId;
            const {FDAccountNumber,fdamount,durationMonths} = req.body
            const currentDate = new Date();
            const startDate = currentDate.toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "2-digit", // Abbreviated year (YY)
              hour: "2-digit",
              minute: "2-digit",
              hour12: true, // Ensures AM/PM format
            });
            const maturityDate = new Date();
            maturityDate.setMonth(maturityDate.getMonth() + durationMonths);
            try {
          
          const newAmount = await FDAccountService.updateFDAccountAmount({FDAccountNumber,fdamount,editedBy,startDate,maturityDate,durationMonths})
              res.status(201).json({ data: newAmount });
            } catch (error) {
              console.error('Error updating FDAccount:', error);
              return { success: false, message: 'An error occurred while updating the amount', error };
            }
          };
module.exports = {
    createFDAccount,
    getFDAccount,
    getCustomerFDAccountById,
    withdrawFixedDeposit,
    withdrawImatureFixedDeposit,
    updateFDAccount,
    createInterest,
    getInterest,
    updateInterest
  };