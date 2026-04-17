const accountTransactionService = require('../Service/index');
const Staff = require('../../../Staff/Model/index');
// const staffService = require('../../../Staff/Service/index')
require('dotenv').config()
const bcrypt = require('bcrypt')

const getBranchStaff = async (req, res) => {
  const staffId = req.params.id;
    try {
        const staff = await accountTransactionService.getBranchStaff(staffId);
        res.status(200).json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
  }
 
      const getAllRepDSAccount = async (req, res) => {
        // const staff = req.params.id
        const staff = req.params.id
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
                const staff = req.params.id
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
        const staff = req.params.id
                    const {date} = req.body
                    try {
                        const SBAccount = await accountTransactionService.getAllRepSBAccount(date,staff);
                        res.status(200).json(SBAccount);
                    } catch (error) {
                        res.status(500).json({ message: error.message });
                    }
                  }
               const getAllFDAccount = async (req, res) => {
                const staff = req.params.id
                      const {date} = req.body
                      try {
                          const FDAccount = await accountTransactionService.getAllFDAccount(date,staff);
                          res.status(200).json(FDAccount);
                      } catch (error) {
                          res.status(500).json({ message: error.message });
                      }
                    }
       
                    const getAllFDPackage = async (req, res) => {
                const staff = req.params.id
                      const {date} = req.body
                      try {
                          const FDAccount = await accountTransactionService.getAllFDPackage(date,staff);
                          res.status(200).json(FDAccount);
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
                    const staff = req.params.id
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
                            const staff = req.params.id
                            const {date} = req.body
                  
                              const DSAccount = await accountTransactionService.getAllRepDailyDSAccount(date,staff);
                              res.status(200).json(DSAccount);
                          } catch (error) {
                              res.status(500).json({ message: error.message });
                          }
                        }
     const getAllRepDailyFDAccount = async (req, res) => {
                          try {
                            const staff = req.params.id
                            const {date} = req.body
                  
                              const DSAccount = await accountTransactionService.getAllRepDailyFDAccount(date,staff);
                              res.status(200).json(DSAccount);
                          } catch (error) {
                              res.status(500).json({ message: error.message });
                          }
                        }
      const getAllRepDailyDSAccountWithdrawal = async (req, res) => {
                          try {
                            const staff = req.params.id
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
                                    const staff = req.params.id
                                    const {date} = req.body
                                    const SBAccount = await accountTransactionService.getAllRepDailySBAccount(date,staff);
                                    res.status(200).json(SBAccount);
                                } catch (error) {
                                    res.status(500).json({ message: error.message });
                                }
                              }
     const getAllRepDailySBAccountWithdrawal = async (req, res) => {
                                try {
                                    const staff = req.params.id
                                    const {date} = req.body
                                    const SBAccount = await accountTransactionService.getAllRepDailySBAccountWithdrawal(date,staff);
                                    res.status(200).json(SBAccount);
                                } catch (error) {
                                    res.status(500).json({ message: error.message });
                                }
                              }
     const getAllRepDailyContribution = async (req, res) => {
                                      try {
                                        const staff = req.params.id
                                        const {date} = req.body
                                          const totalContribution = await accountTransactionService.getAllRepDailySBandDSAccount(date,staff);
                                          res.status(200).json(totalContribution);
                                      } catch (error) {
                                          res.status(500).json({ message: error.message });
                                      }
                                    }
    const getAllRepDSAccountPackage = async (req, res) => {
        const staff = req.params.id
        const {date} = req.body
                try {
                    const DSAccount = await accountTransactionService.getAllRepDSAccountPackage(date,staff);
                    res.status(200).json(DSAccount);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
     const getAllRepSBAccountPackage = async (req, res) => {
        const staff = req.params.id
        const {date} = req.body
                try {
                    const SBAccount = await accountTransactionService.getAllRepSBAccountPackage(date,staff);
                    res.status(200).json(SBAccount);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
     const getAllRepAccountPackage = async (req, res) => {
        const staff = req.params.id
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
                   const staff = req.params.id
        const {date} = req.body
                const SBAccount = await accountTransactionService.getRepSBAccountIncome(date,staff);
                res.status(200).json(SBAccount);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
          }
          const getRepDSAccountIncome = async (req, res) => {
            try {
                   const staff = req.params.id
        const {date} = req.body
                const SBAccount = await accountTransactionService.getRepDSAccountIncome(date,staff);
                res.status(200).json(SBAccount);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
          }
          const getRepAllSBandDSIncome = async (req, res) => {
            try {
                   const staff = req.params.id
                    const {date} = req.body
                const totalContribution = await accountTransactionService.getRepAllSBandDSIncome(date,staff);
                res.status(200).json(totalContribution);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
          }
            const getRepAllExpenditure = async (req, res) => {
                const staff = req.params.id
                const {date} = req.body
                try {
                    const expenditure = await accountTransactionService.getRepAllExpenditure(date,staff);
                    res.status(200).json(expenditure);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getRepProfit = async (req, res) => {
                const staff = req.params.id
                const {date} = req.body
                try {
                    const profit = await accountTransactionService.getRepProfit(date,staff);
                    res.status(200).json(profit);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
           const getRepSBIncomeReport = async (req, res) => {
            const staff = req.params.id
                try {
                    const SBIncomeReport = await accountTransactionService.getRepSBIncomeReport(staff);
                    res.status(200).json(SBIncomeReport);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getRepDSIncomeReport = async (req, res) => {
                const staff = req.params.id
                try {
                    const DSIncomeReport = await accountTransactionService.getRepDSIncomeReport(staff);
                    res.status(200).json(DSIncomeReport);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getRepExpenditureReport = async (req, res) => {
                const staff = req.params.id
                try {
                    const ExpenditureReport = await accountTransactionService.getRepExpenditureReport(staff);
                    res.status(200).json(ExpenditureReport);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getTransaction = async (req, res) => {
            const createdBy = req.params.id;
        
                try {
                    const transaction = await accountTransactionService.getTransaction(createdBy);
                    res.status(200).json(transaction);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getRepOrder = async (req, res) => {
            const staff = req.params.id
        
                try {
                    const order = await accountTransactionService.getRepOrder(staff);
                    res.status(200).json(order);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getRepEcommerceDeposit = async (req, res) => {
                const staff = req.params.id;
                const { date } = req.body;

                try {
                    const ecommerceDeposit = await accountTransactionService.getRepEcommerceDeposit(date, staff);
                    res.status(200).json(ecommerceDeposit);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
              const getRepEcommerceDepositReport = async (req, res) => {
                const staff = req.params.id;
                const { date } = req.body;

                try {
                    const report = await accountTransactionService.getRepEcommerceDepositReport(date, staff);
                    res.status(200).json(report);
                } catch (error) {
                    res.status(500).json({ message: error.message });
                }
              }
                    const getCustomerByRep = async (req, res) => {
                      const staffId = req.params.id;
              
                      try {
                          const customers = await accountTransactionService.getCustomerByRep(staffId);
                          res.status(200).json(customers);
                      } catch (error) {
                          res.status(500).json({ message: error.message });
                      }
                    }
                    const getReferralStaff = async (req, res) => {
                            const staffs = req.params.id
                      const {date} = req.body
                        try {
                            const staff = await accountTransactionService.getReferralStaff(staffs,date);
                            res.status(200).json(staff);
                        } catch (error) {
                            res.status(500).json({ message: error.message });
                        }
                      }
const getReferralStaffDetails = async (req, res) => {
  const referralId = req.params.id;
  const { date } = req.body;

  try {
    if (!referralId) {
      return res.status(400).json({ message: "Referral ID is required" });
    }

    // 🔁 Get the referral chain
    const referralDetails = await accountTransactionService.getReferralStaffDetails(referralId, date);

    if (!referralDetails || referralDetails.length === 0) {
      return res.status(404).json({ message: "No referred staff found in the chain" });
    }

    // ✅ Structured response
    res.status(200).json({
      message: "Referral chain staff details fetched successfully",
      totalCount: referralDetails.length,
      data: referralDetails,
    });
  } catch (error) {
    console.error("Error in getReferralStaffDetails controller:", error);
    res.status(500).json({
      message: "Server error while fetching referral chain staff details",
      error: error.message,
    });
  }
};



/**
 * Controller to handle referral staff order counting
 */
async function getReferralStaffOrderCounts(req, res) {
  const referralId = req.params.id;

  try {
    const { startDate, endDate } = req.body;

    if (!referralId) {
      return res.status(400).json({ message: "referralId is required" });
    }

    // Recursive function to get all referred staff (chain referrals)
    const getAllReferredStaff = async (referralIds, collected = new Map()) => {
      // Find all staff referred by any of these referralIds
      const referredStaff = await Staff.find({ referral: { $in: referralIds } });

      if (!referredStaff.length) return collected;

      for (const staff of referredStaff) {
        if (!collected.has(staff._id.toString())) {
          collected.set(staff._id.toString(), staff);
        }
      }

      const nextReferralIds = referredStaff.map((s) => s._id);
      return getAllReferredStaff(nextReferralIds, collected);
    };

    // Start recursive referral search
    const initialStaffList = await Staff.find({ referral: referralId });
    if (!initialStaffList.length) {
      return res.status(404).json({ message: "No staff found for this referral" });
    }

    // Collect all staff recursively
    const allStaffMap = new Map();
    for (const staff of initialStaffList) {
      allStaffMap.set(staff._id.toString(), staff);
    }

    await getAllReferredStaff(initialStaffList.map((s) => s._id), allStaffMap);

    // Convert map to array
    const allStaffList = Array.from(allStaffMap.values());

    // Count orders for all staff (chain)
    const counts = await accountTransactionService.getStaffOrderCounts(
      allStaffList,
      startDate,
      endDate
    );

    res.status(200).json({
      message: "Referral chain staff order counts fetched successfully",
      totalStaff: allStaffList.length,
      data: counts,
    });
  } catch (error) {
    console.error("Error in getReferralStaffOrderCounts:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
}




      module.exports = {
        getAllRepDSAccount,
        getAllRepDSAccountWithdrawal,
        getAllRepDSAccountCharge,
        getAllRepSBAccount,
        getAllFDAccount,
        getAllFDPackage,
        getAllRepSBAccountWithdrawal,
        getAllRepContribution,
        getAllRepDailyDSAccount,
        getAllRepDailyFDAccount,
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
        getRepEcommerceDeposit,
        getRepEcommerceDepositReport,
        getBranchStaff,
        getCustomerByRep,
        getReferralStaff,
        getReferralStaffDetails,
        getReferralStaffOrderCounts
      };
