const accountTransactionService = require('../Service/index');
require('dotenv').config()
const bcrypt = require('bcrypt')
 
      const getAllDSAccount = async (req, res) => {
        try {
            const DSAccount = await accountTransactionService.getAllDSAccount();
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
        try {
            const SBAccount = await accountTransactionService.getAllSBAccount();
            res.status(200).json(SBAccount);
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
        try {
            const totalContribution = await accountTransactionService.getAllSBandDSAccount();
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
        try {
            const DSAccount = await accountTransactionService.getAllDSAccountPackage();
            res.status(200).json(DSAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllSBAccountPackage = async (req, res) => {
        try {
            const SBAccount = await accountTransactionService.getAllSBAccountPackage();
            res.status(200).json(SBAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
      const getAllAccountPackage = async (req, res) => {
        try {
            const packages = await accountTransactionService.getAllAccountPackage();
            res.status(200).json(packages);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }

  module.exports = {
    getAllDSAccount,
    getAllDSAccountWithdrawal,
    getAllDSAccountCharge,
    getAllSBAccount,
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
    getAllSBandDSIncome
  };