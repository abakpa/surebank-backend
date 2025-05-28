const accountTransactionService = require('../Service/index');
require('dotenv').config()
const bcrypt = require('bcrypt')
 
      const getAllBranchDSAccount = async (req, res) => {
        const staff = req.staff.staffId;
        const {date} = req.body
        try {
            const DSAccount = await accountTransactionService.getAllBranchDSAccount(date,staff);
            res.status(200).json(DSAccount);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
         const getAllFDAccount = async (req, res) => {
        const staff = req.staff.staffId;

              const {date} = req.body
              try {
                  const FDAccount = await accountTransactionService.getAllFDAccount(date,staff);
                  res.status(200).json(FDAccount);
              } catch (error) {
                  res.status(500).json({ message: error.message });
              }
            }
            const getAllFDInterestIncome = async (req, res) => {
        const staff = req.staff.staffId;

              const {date} = req.body
              try {
                  const FDAccount = await accountTransactionService.getAllFDInterestIncome(date,staff);
                  res.status(200).json(FDAccount);
              } catch (error) {
                  res.status(500).json({ message: error.message });
              }
            }
            const getAllFDInterestExpense = async (req, res) => {
        const staff = req.staff.staffId;

              const {date} = req.body
              try {
                  const FDAccount = await accountTransactionService.getAllFDInterestExpense(date,staff);
                  res.status(200).json(FDAccount);
              } catch (error) {
                  res.status(500).json({ message: error.message });
              }
            }
            const getAllFDTransaction = async (req, res) => {
        const staff = req.staff.staffId;

              const {date} = req.body
              try {
                  const FDAccount = await accountTransactionService.getAllFDTransaction(date,staff);
                  res.status(200).json(FDAccount);
              } catch (error) {
                  res.status(500).json({ message: error.message });
              }
            }
            const getAllFDPackage = async (req, res) => {
        const staff = req.staff.staffId;

              const {date} = req.body
              try {
                  const FDAccount = await accountTransactionService.getAllFDPackage(date,staff);
                  res.status(200).json(FDAccount);
              } catch (error) {
                  res.status(500).json({ message: error.message });
              }
            }
    const getAllBranchDSAccountWithdrawal = async (req, res) => {
              try {
                const staff = req.staff.staffId;
                const {date} = req.body
                  const DSAccount = await accountTransactionService.getAllDSAccountWithdrawal(date,staff);
                  res.status(200).json(DSAccount);
              } catch (error) {
                  res.status(500).json({ message: error.message });
              }
            }
     const getAllBranchDSAccountCharge = async (req, res) => {
              try {
                  const DSAccount = await accountTransactionService.getAllDSAccountCharge();
                  res.status(200).json(DSAccount);
              } catch (error) {
                  res.status(500).json({ message: error.message });
              }
            }
     const getAllBranchSBAccount = async (req, res) => {
                    const staff = req.staff.staffId;
                    const {date} = req.body
                    try {
                        const SBAccount = await accountTransactionService.getAllBranchSBAccount(date,staff);
                        res.status(200).json(SBAccount);
                    } catch (error) {
                        res.status(500).json({ message: error.message });
                    }
                  }
     const getAllBranchSBAccountWithdrawal = async (req, res) => {
                    try {
                        const SBAccount = await accountTransactionService.getAllBranchSBAccountWithdrawal();
                        res.status(200).json(SBAccount);
                    } catch (error) {
                        res.status(500).json({ message: error.message });
                    }
                  }
     const getAllBranchContribution = async (req, res) => {
                    const staff = req.staff.staffId;
                    const {date} = req.body
                    try {
                        const totalContribution = await accountTransactionService.getAllBranchSBandDSAccount(date,staff);
                        res.status(200).json(totalContribution);
                    } catch (error) {
                        res.status(500).json({ message: error.message });
                    }
                  }
     const getAllBranchDailyDSAccount = async (req, res) => {
                          try {
                            const staff = req.staff.staffId;
                            const {date} = req.body
                  
                              const DSAccount = await accountTransactionService.getAllBranchDailyDSAccount(date,staff);
                              res.status(200).json(DSAccount);
                          } catch (error) {
                              res.status(500).json({ message: error.message });
                          }
                        }
     const getAllBranchDailyFDAccount = async (req, res) => {
                          try {
                            const staff = req.staff.staffId;
                            const {date} = req.body
                  
                              const DSAccount = await accountTransactionService.getAllBranchDailyFDAccount(date,staff);
                              res.status(200).json(DSAccount);
                          } catch (error) {
                              res.status(500).json({ message: error.message });
                          }
                        }
      const getAllBranchDailyDSAccountWithdrawal = async (req, res) => {
                          try {
                            const staff = req.staff.staffId;
                            const {date} = req.body
                              const DSAccount = await accountTransactionService.getAllBranchDailyDSAccountWithdrawal(date,staff);
                              res.status(200).json(DSAccount);
                          } catch (error) {
                              res.status(500).json({ message: error.message });
                          }
                        }
      const getAllBranchDailyDSAccountCharge = async (req, res) => {
                          try {
                              const {date,branchId} = req.body
                              const DSAccount = await accountTransactionService.getAllBranchDailyDSAccountCharge(date,branchId);
                              res.status(200).json(DSAccount);
                          } catch (error) {
                              res.status(500).json({ message: error.message });
                          }
                        }

     const getAllBranchDailySBAccount = async (req, res) => {
                                try {
                                    const staff = req.staff.staffId;
                                    const {date} = req.body
                                    const SBAccount = await accountTransactionService.getAllBranchDailySBAccount(date,staff);
                                    res.status(200).json(SBAccount);
                                } catch (error) {
                                    res.status(500).json({ message: error.message });
                                }
                              }
     const getAllBranchDailySBAccountWithdrawal = async (req, res) => {
                                try {
                                    const staff = req.staff.staffId;
                                    const {date} = req.body
                                    const SBAccount = await accountTransactionService.getAllBranchDailySBAccountWithdrawal(date,staff);
                                    res.status(200).json(SBAccount);
                                } catch (error) {
                                    res.status(500).json({ message: error.message });
                                }
                              }
     const getAllBranchDailyContribution = async (req, res) => {
                                      try {
                                        const staff = req.staff.staffId;
                                        const {date} = req.body
                                          const totalContribution = await accountTransactionService.getAllBranchDailySBandDSAccount(date,staff);
                                          res.status(200).json(totalContribution);
                                      } catch (error) {
                                          res.status(500).json({ message: error.message });
                                      }
                                    }
    const getAllBranchDSAccountPackage = async (req, res) => {
        const staff = req.staff.staffId;
        const {date} = req.body
                try {
                    const DSAccount = await accountTransactionService.getAllBranchDSAccountPackage(date,staff);
                    res.status(200).json(DSAccount);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
     const getAllBranchSBAccountPackage = async (req, res) => {
        const staff = req.staff.staffId;
        const {date} = req.body
                try {
                    const SBAccount = await accountTransactionService.getAllBranchSBAccountPackage(date,staff);
                    res.status(200).json(SBAccount);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
     const getAllBranchAccountPackage = async (req, res) => {
        const staff = req.staff.staffId;
        const {date} = req.body
                try {
                    const packages = await accountTransactionService.getAllBranchAccountPackage(date,staff);
                    res.status(200).json(packages);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
         const getBranchSBAccountIncome = async (req, res) => {
            try {
                   const staff = req.staff.staffId;
        const {date} = req.body
                const SBAccount = await accountTransactionService.getBranchSBAccountIncome(date,staff);
                res.status(200).json(SBAccount);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
          }
          const getBranchDSAccountIncome = async (req, res) => {
            try {
                   const staff = req.staff.staffId;
        const {date} = req.body
                const SBAccount = await accountTransactionService.getBranchDSAccountIncome(date,staff);
                res.status(200).json(SBAccount);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
          }
          const getBranchAllSBandDSIncome = async (req, res) => {
            try {
                   const staff = req.staff.staffId;
                    const {date} = req.body
                const totalContribution = await accountTransactionService.getBranchAllSBandDSIncome(date,staff);
                res.status(200).json(totalContribution);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
          }
            const getBranchAllExpenditure = async (req, res) => {
                const staff = req.staff.staffId;
                const {date} = req.body
                try {
                    const expenditure = await accountTransactionService.getBranchAllExpenditure(date,staff);
                    res.status(200).json(expenditure);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getBranchProfit = async (req, res) => {
                const staff = req.staff.staffId;
                const {date} = req.body
                try {
                    const profit = await accountTransactionService.getBranchProfit(date,staff);
                    res.status(200).json(profit);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
           const getBranchSBIncomeReport = async (req, res) => {
            const staff = req.staff.staffId;
                try {
                    const SBIncomeReport = await accountTransactionService.getBranchSBIncomeReport(staff);
                    res.status(200).json(SBIncomeReport);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getBranchDSIncomeReport = async (req, res) => {
                const staff = req.staff.staffId;
                try {
                    const DSIncomeReport = await accountTransactionService.getBranchDSIncomeReport(staff);
                    res.status(200).json(DSIncomeReport);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getBranchExpenditureReport = async (req, res) => {
                const staff = req.staff.staffId;
                try {
                    const ExpenditureReport = await accountTransactionService.getBranchExpenditureReport(staff);
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
              const getBranchOrder = async (req, res) => {
            const staff = req.staff.staffId;
        
                try {
                    const order = await accountTransactionService.getBranchOrder(staff);
                    res.status(200).json(order);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }

      module.exports = {
        getAllBranchDSAccount,
        getAllFDAccount,
        getAllFDInterestIncome,
        getAllFDInterestExpense,
        getAllFDTransaction,
        getAllFDPackage,
        getAllBranchDSAccountWithdrawal,
        getAllBranchDSAccountCharge,
        getAllBranchSBAccount,
        getAllBranchSBAccountWithdrawal,
        getAllBranchContribution,
        getAllBranchDailyDSAccount,
        getAllBranchDailyFDAccount,
        getAllBranchDailyDSAccountWithdrawal,
        getAllBranchDailyDSAccountCharge,
        getAllBranchDailySBAccount,
        getAllBranchDailySBAccountWithdrawal,
        getAllBranchDailyContribution,
        getAllBranchDSAccountPackage,
        getAllBranchSBAccountPackage,
        getAllBranchAccountPackage,
        getBranchSBAccountIncome,
        getBranchDSAccountIncome,
        getBranchAllSBandDSIncome,
        getBranchAllExpenditure,
        getBranchProfit,
        getBranchSBIncomeReport,
        getBranchDSIncomeReport,
        getBranchExpenditureReport,
        getTransaction,
        getBranchOrder,
      };