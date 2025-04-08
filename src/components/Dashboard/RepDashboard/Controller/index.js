const accountTransactionService = require('../Service/index');
require('dotenv').config()
const bcrypt = require('bcrypt')
 
      const getAllRepDSAccount = async (req, res) => {
        const staff = req.staff.staffId;
        const {date} = req.body
        try {
            const DSAccount = await accountTransactionService.getAllRepDSAccount(date,staff);
            res.status(200).json(DSAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
    const getAllRepDSAccountWithdrawal = async (req, res) => {
              try {
                const staff = req.staff.staffId;
                const {date} = req.body
                  const DSAccount = await accountTransactionService.getAllDSAccountWithdrawal(date,staff);
                  res.status(200).json(DSAccount);
              } catch (error) {
                  res.status(500).json({ message: error.message });
              }
            }
     const getAllRepDSAccountCharge = async (req, res) => {
              try {
                  const DSAccount = await accountTransactionService.getAllDSAccountCharge();
                  res.status(200).json(DSAccount);
              } catch (error) {
                  res.status(500).json({ message: error.message });
              }
            }
     const getAllRepSBAccount = async (req, res) => {
                    const staff = req.staff.staffId;
                    const {date} = req.body
                    try {
                        const SBAccount = await accountTransactionService.getAllRepSBAccount(date,staff);
                        res.status(200).json(SBAccount);
                    } catch (error) {
                        res.status(500).json({ message: error.message });
                    }
                  }
     const getAllRepSBAccountWithdrawal = async (req, res) => {
                    try {
                        const SBAccount = await accountTransactionService.getAllRepSBAccountWithdrawal();
                        res.status(200).json(SBAccount);
                    } catch (error) {
                        res.status(500).json({ message: error.message });
                    }
                  }
     const getAllRepContribution = async (req, res) => {
                    const staff = req.staff.staffId;
                    const {date} = req.body
                    try {
                        const totalContribution = await accountTransactionService.getAllRepSBandDSAccount(date,staff);
                        res.status(200).json(totalContribution);
                    } catch (error) {
                        res.status(500).json({ message: error.message });
                    }
                  }
     const getAllRepDailyDSAccount = async (req, res) => {
                          try {
                            const staff = req.staff.staffId;
                            const {date} = req.body
                  
                              const DSAccount = await accountTransactionService.getAllRepDailyDSAccount(date,staff);
                              res.status(200).json(DSAccount);
                          } catch (error) {
                              res.status(500).json({ message: error.message });
                          }
                        }
      const getAllRepDailyDSAccountWithdrawal = async (req, res) => {
                          try {
                            const staff = req.staff.staffId;
                            const {date} = req.body
                              const DSAccount = await accountTransactionService.getAllRepDailyDSAccountWithdrawal(date,staff);
                              res.status(200).json(DSAccount);
                          } catch (error) {
                              res.status(500).json({ message: error.message });
                          }
                        }
      const getAllRepDailyDSAccountCharge = async (req, res) => {
                          try {
                              const {date,RepId} = req.body
                              const DSAccount = await accountTransactionService.getAllRepDailyDSAccountCharge(date,RepId);
                              res.status(200).json(DSAccount);
                          } catch (error) {
                              res.status(500).json({ message: error.message });
                          }
                        }

     const getAllRepDailySBAccount = async (req, res) => {
                                try {
                                    const staff = req.staff.staffId;
                                    const {date} = req.body
                                    const SBAccount = await accountTransactionService.getAllRepDailySBAccount(date,staff);
                                    res.status(200).json(SBAccount);
                                } catch (error) {
                                    res.status(500).json({ message: error.message });
                                }
                              }
     const getAllRepDailySBAccountWithdrawal = async (req, res) => {
                                try {
                                    const staff = req.staff.staffId;
                                    const {date} = req.body
                                    const SBAccount = await accountTransactionService.getAllRepDailySBAccountWithdrawal(date,staff);
                                    res.status(200).json(SBAccount);
                                } catch (error) {
                                    res.status(500).json({ message: error.message });
                                }
                              }
     const getAllRepDailyContribution = async (req, res) => {
                                      try {
                                        const staff = req.staff.staffId;
                                        const {date} = req.body
                                          const totalContribution = await accountTransactionService.getAllRepDailySBandDSAccount(date,staff);
                                          res.status(200).json(totalContribution);
                                      } catch (error) {
                                          res.status(500).json({ message: error.message });
                                      }
                                    }
    const getAllRepDSAccountPackage = async (req, res) => {
        const staff = req.staff.staffId;
        const {date} = req.body
                try {
                    const DSAccount = await accountTransactionService.getAllRepDSAccountPackage(date,staff);
                    res.status(200).json(DSAccount);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
     const getAllRepSBAccountPackage = async (req, res) => {
        const staff = req.staff.staffId;
        const {date} = req.body
                try {
                    const SBAccount = await accountTransactionService.getAllRepSBAccountPackage(date,staff);
                    res.status(200).json(SBAccount);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
     const getAllRepAccountPackage = async (req, res) => {
        const staff = req.staff.staffId;
        const {date} = req.body
                try {
                    const packages = await accountTransactionService.getAllRepAccountPackage(date,staff);
                    res.status(200).json(packages);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
         const getRepSBAccountIncome = async (req, res) => {
            try {
                   const staff = req.staff.staffId;
        const {date} = req.body
                const SBAccount = await accountTransactionService.getRepSBAccountIncome(date,staff);
                res.status(200).json(SBAccount);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
          }
          const getRepDSAccountIncome = async (req, res) => {
            try {
                   const staff = req.staff.staffId;
        const {date} = req.body
                const SBAccount = await accountTransactionService.getRepDSAccountIncome(date,staff);
                res.status(200).json(SBAccount);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
          }
          const getRepAllSBandDSIncome = async (req, res) => {
            try {
                   const staff = req.staff.staffId;
                    const {date} = req.body
                const totalContribution = await accountTransactionService.getRepAllSBandDSIncome(date,staff);
                res.status(200).json(totalContribution);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
          }
            const getRepAllExpenditure = async (req, res) => {
                const staff = req.staff.staffId;
                const {date} = req.body
                try {
                    const expenditure = await accountTransactionService.getRepAllExpenditure(date,staff);
                    res.status(200).json(expenditure);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getRepProfit = async (req, res) => {
                const staff = req.staff.staffId;
                const {date} = req.body
                try {
                    const profit = await accountTransactionService.getRepProfit(date,staff);
                    res.status(200).json(profit);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
           const getRepSBIncomeReport = async (req, res) => {
            const staff = req.staff.staffId;
                try {
                    const SBIncomeReport = await accountTransactionService.getRepSBIncomeReport(staff);
                    res.status(200).json(SBIncomeReport);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getRepDSIncomeReport = async (req, res) => {
                const staff = req.staff.staffId;
                try {
                    const DSIncomeReport = await accountTransactionService.getRepDSIncomeReport(staff);
                    res.status(200).json(DSIncomeReport);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getRepExpenditureReport = async (req, res) => {
                const staff = req.staff.staffId;
                try {
                    const ExpenditureReport = await accountTransactionService.getRepExpenditureReport(staff);
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
              const getRepOrder = async (req, res) => {
            const staff = req.staff.staffId;
        
                try {
                    const order = await accountTransactionService.getRepOrder(staff);
                    res.status(200).json(order);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }

      module.exports = {
        getAllRepDSAccount,
        getAllRepDSAccountWithdrawal,
        getAllRepDSAccountCharge,
        getAllRepSBAccount,
        getAllRepSBAccountWithdrawal,
        getAllRepContribution,
        getAllRepDailyDSAccount,
        getAllRepDailyDSAccountWithdrawal,
        getAllRepDailyDSAccountCharge,
        getAllRepDailySBAccount,
        getAllRepDailySBAccountWithdrawal,
        getAllRepDailyContribution,
        getAllRepDSAccountPackage,
        getAllRepSBAccountPackage,
        getAllRepAccountPackage,
        getRepSBAccountIncome,
        getRepDSAccountIncome,
        getRepAllSBandDSIncome,
        getRepAllExpenditure,
        getRepProfit,
        getRepSBIncomeReport,
        getRepDSIncomeReport,
        getRepExpenditureReport,
        getTransaction,
        getRepOrder,
      };