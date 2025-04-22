const accountTransactionService = require('../Service/index');
require('dotenv').config()
const bcrypt = require('bcrypt')
 
      const getAllDSAccount = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const DSAccount = await accountTransactionService.getAllDSAccount(date,branchId);
            res.status(200).json(DSAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllDSAccountWithdrawal = async (req, res) => {
        try {
            const {date,branchId} = req.body
            const DSAccount = await accountTransactionService.getAllDSAccountWithdrawal(date,branchId);
            res.status(200).json(DSAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllDSAccountCharge = async (req, res) => {
        try {
            const DSAccount = await accountTransactionService.getAllDSAccountCharge();
            res.status(200).json(DSAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
 
      const getAllSBAccount = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const SBAccount = await accountTransactionService.getAllSBAccount(date,branchId);
            res.status(200).json(SBAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllFDAccount = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const FDAccount = await accountTransactionService.getAllFDAccount(date,branchId);
            res.status(200).json(FDAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllFDInterestIncome = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const FDAccount = await accountTransactionService.getAllFDInterestIncome(date,branchId);
            res.status(200).json(FDAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllFDInterestExpense = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const FDAccount = await accountTransactionService.getAllFDInterestExpense(date,branchId);
            res.status(200).json(FDAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllFDTransaction = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const FDAccount = await accountTransactionService.getAllFDTransaction(date,branchId);
            res.status(200).json(FDAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllFDPackage = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const FDAccount = await accountTransactionService.getAllFDPackage(date,branchId);
            res.status(200).json(FDAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllSBAccountWithdrawal = async (req, res) => {
        try {
            const SBAccount = await accountTransactionService.getAllSBAccountWithdrawal();
            res.status(200).json(SBAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllContribution = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const totalContribution = await accountTransactionService.getAllSBandDSAccount(date,branchId);
            res.status(200).json(totalContribution);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllDailyDSAccount = async (req, res) => {
        try {
            const {date,branchId} = req.body

            const DSAccount = await accountTransactionService.getAllDailyDSAccount(date,branchId);
            res.status(200).json(DSAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllDailyDSAccountWithdrawal = async (req, res) => {
        try {
            const {date,branchId} = req.body
            const DSAccount = await accountTransactionService.getAllDailyDSAccountWithdrawal(date,branchId);
            res.status(200).json(DSAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllDailyDSAccountCharge = async (req, res) => {
        try {
            const {date,branchId} = req.body
            const DSAccount = await accountTransactionService.getAllDailyDSAccountCharge(date,branchId);
            res.status(200).json(DSAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
 
      const getAllDailySBAccount = async (req, res) => {
        try {
            const {date,branchId} = req.body
            const SBAccount = await accountTransactionService.getAllDailySBAccount(date,branchId);
            res.status(200).json(SBAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllDailySBAccountWithdrawal = async (req, res) => {
        try {
            const {date,branchId} = req.body
            const SBAccount = await accountTransactionService.getAllDailySBAccountWithdrawal(date,branchId);
            res.status(200).json(SBAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getSBAccountIncome = async (req, res) => {
        try {
            const {date,branchId} = req.body
            const SBAccount = await accountTransactionService.getSBAccountIncome(date,branchId);
            res.status(200).json(SBAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getDSAccountIncome = async (req, res) => {
        try {
            const {date,branchId} = req.body
            const SBAccount = await accountTransactionService.getDSAccountIncome(date,branchId);
            res.status(200).json(SBAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllSBandDSIncome = async (req, res) => {
        try {
            const {date,branchId} = req.body
            const totalContribution = await accountTransactionService.getAllSBandDSIncome(date,branchId);
            res.status(200).json(totalContribution);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllDailyContribution = async (req, res) => {
        try {
            const {date,branchId} = req.body
            const totalContribution = await accountTransactionService.getAllDailySBandDSAccount(date,branchId);
            res.status(200).json(totalContribution);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllDSAccountPackage = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const DSAccount = await accountTransactionService.getAllDSAccountPackage(date,branchId);
            res.status(200).json(DSAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllSBAccountPackage = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const SBAccount = await accountTransactionService.getAllSBAccountPackage(date,branchId);
            res.status(200).json(SBAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllAccountPackage = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const packages = await accountTransactionService.getAllAccountPackage(date,branchId);
            res.status(200).json(packages);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllExpenditure = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const expenditure = await accountTransactionService.getAllExpenditure(date,branchId);
            res.status(200).json(expenditure);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getProfit = async (req, res) => {
        const {date,branchId} = req.body
        try {
            const profit = await accountTransactionService.getProfit(date,branchId);
            res.status(200).json(profit);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getSBIncomeReport = async (req, res) => {
        try {
            const SBIncomeReport = await accountTransactionService.getSBIncomeReport();
            res.status(200).json(SBIncomeReport);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getDSIncomeReport = async (req, res) => {
        try {
            const DSIncomeReport = await accountTransactionService.getDSIncomeReport();
            res.status(200).json(DSIncomeReport);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getExpenditureReport = async (req, res) => {
        try {
            const ExpenditureReport = await accountTransactionService.getExpenditureReport();
            res.status(200).json(ExpenditureReport);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getTransaction = async (req, res) => {
    const createdBy = req.staff.staffId;

        try {
            const transaction = await accountTransactionService.getTransaction(createdBy);
            res.status(200).json(transaction);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getOrder = async (req, res) => {
    // const createdBy = req.staff.staffId;

        try {
            const order = await accountTransactionService.getOrder();
            res.status(200).json(order);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }

  module.exports = {
    getAllDSAccount,
    getAllDSAccountWithdrawal,
    getAllDSAccountCharge,
    getAllSBAccount,
    getAllFDAccount,
    getAllFDInterestIncome,
    getAllFDInterestExpense,
    getAllFDTransaction,
    getAllFDPackage,
    getAllSBAccountWithdrawal,
    getAllContribution,
    getAllDailyDSAccount,
    getAllDailyDSAccountWithdrawal,
    getAllDailyDSAccountCharge,
    getAllDailySBAccount,
    getAllDailySBAccountWithdrawal,
    getAllDailyContribution,
    getAllDSAccountPackage,
    getAllSBAccountPackage,
    getAllAccountPackage,
    getSBAccountIncome,
    getDSAccountIncome,
    getAllSBandDSIncome,
    getAllExpenditure,
    getProfit,
    getSBIncomeReport,
    getDSIncomeReport,
    getExpenditureReport,
    getTransaction,
    getOrder,
  };