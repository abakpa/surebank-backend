const Account = require('../../../Account/Model/index');
const AccountTransaction = require('../../../AccountTransaction/Model/index');
const DSAccount = require('../../../DSAccount/Model');
const SBAccount = require('../../../SBAccount/Model');
const SureBankAccount = require('../../../SureBankAccount/Model');
const Expenditure = require('../../../Expenditure/Model');
const FDAccount = require('../../../FDAccount/Model');


async function getAllDSAccount(date = null, branchId = null) {

    let query = { package: 'DS', direction: 'Credit' };
    
   
    // Filter by date if provided or default to today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = { $lte: endDate };
  
    // Filter by branch if provided
    if (branchId) {
      query.branchId = branchId;
    }
    const transactions = await AccountTransaction.find(query);
    
    // // Sort transactions by createdAt in ascending order
    // transactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // // Use a Map to store the latest balance for each accountTypeId
    // const balanceMap = new Map();
    
    // transactions.forEach(tx => {
    //     balanceMap.set(tx.accountTypeId, tx.balance);
    // });
    
    // // Calculate the sum of the latest balances
    // const totalBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0);
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    const dswithdrawal = await getAllDSAccountWithdrawal(date,branchId);
    const charge  = await getAllDSAccountCharge(date,branchId);
    const Withdrawal = dswithdrawal + charge
    
    return totalBalance - Withdrawal;
}
async function getAllDSAccountWithdrawal(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Debit' };

     // Filter by date if provided or default to today
     const endDate = date ? new Date(date) : new Date();
     endDate.setHours(23, 59, 59, 999);
     query.createdAt = { $lte: endDate };

    if (branchId) {
        query.branchId = branchId;
    }


    const transactions = await AccountTransaction.find(query);

    // Sum up all withdrawal amounts directly
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return totalBalance;
}


async function getAllDSAccountCharge(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Charge' };
       // Filter by date if provided or default to today
       const endDate = date ? new Date(date) : new Date();
       endDate.setHours(23, 59, 59, 999);
       query.createdAt = { $lte: endDate };
     
       // Filter by branch if provided
       if (branchId) {
         query.branchId = branchId;
       }
    const transactions = await AccountTransaction.find(query);
    
   // Sum up all charge amounts directly
   const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    
    return totalBalance;
}

async function getAllSBAccount(date = null, branchId = null) {
    let query = { package: 'SB', direction: 'Credit' };
    
   
    // Filter by date if provided or default to today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = { $lte: endDate };
  
    // Filter by branch if provided
    if (branchId) {
      query.branchId = branchId;
    }
    const transactions = await AccountTransaction.find(query);
    
    // Sort transactions by createdAt in ascending order
    // transactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // // Use a Map to store the latest balance for each accountNumber
    // const balanceMap = new Map();
    
    // transactions.forEach(tx => {
    //     balanceMap.set(tx.accountTypeId, tx.balance);
    // });
    
    // Calculate the sum of the latest balances
    // const totalBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0);
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    const SBWithdrawal = await getAllSBAccountWithdrawal(date,branchId)
    
    return totalBalance - SBWithdrawal;
}
async function getAllFDAccount(date = null, branchId = null) {
  try {
    const query = {
      status: { $in: ['Active', 'Matured'] } // ✅ Correct way to match multiple values
    };

    // ✅ Use the end of the given date or today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = { $lte: endDate };

    // ✅ Add branch filter if provided
    if (branchId) {
      query.branchId = branchId;
    }

    const transactions = await FDAccount.find(query);

    // ✅ Sum up fdamounts safely
    const totalBalance = transactions.reduce((sum, tx) => sum + (tx.fdamount || 0), 0);

    return totalBalance;

  } catch (error) {
    console.error("Error fetching FD accounts:", error);
    return 0; // ✅ Return 0 directly instead of assigning
  }
}

async function getAllFDInterestIncome(date = null, branchId = null) {
  try {
    const query = {
      status: { $in: ['Active', 'Matured'] } // ✅ Correct way to match multiple values
    };

    // Set end of the provided date or today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = { $lte: endDate };

    // Filter by branch if branchId is provided
    if (branchId) {
      query.branchId = branchId;
    }

    const transactions = await FDAccount.find(query);

    const totalBalance = transactions.reduce((sum, tx) => sum + (tx.incomeInterest || 0), 0);

    return totalBalance
  } catch (error) {
    console.error("Error fetching FD accounts:", error);
    return totalBalance = 0
  }
}
async function getAllFDInterestExpense(date = null, branchId = null) {
  try {
    const query = {
      status: { $in: ['Active', 'Matured'] } // ✅ Correct way to match multiple values
    };

    // Set end of the provided date or today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = { $lte: endDate };

    // Filter by branch if branchId is provided
    if (branchId) {
      query.branchId = branchId;
    }

    const transactions = await FDAccount.find(query);

    const totalBalance = transactions.reduce((sum, tx) => sum + (tx.expenseInterest || 0), 0);

    return totalBalance
  } catch (error) {
    console.error("Error fetching FD accounts:", error);
    return totalBalance = 0
  }
}
async function getAllFDTransaction(date = null, branchId = null) {
  try {
    // Set date filter
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Build match query
    const match = {
      createdAt: { $lte: endDate }
    };

    if (branchId) {
      match.branchId = branchId;
    }

    // Use aggregation to add sort priority and sort accordingly
    const transactions = await FDAccount.aggregate([
      { $match: match },
      {
        $addFields: {
          statusOrder: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "Matured"] }, then: 1 },
                { case: { $eq: ["$status", "Active"] }, then: 2 },
              ],
              default: 3
            }
          }
        }
      },
      { $sort: { statusOrder: 1} }, // Sort by statusOrder, then by date
    ]);

    // Manually populate if needed (Mongoose's .aggregate doesn't populate)
    const populatedTransactions = await FDAccount.populate(transactions, [
      { path: 'createdBy', model: 'Staff' },
      { path: 'branchId', model: 'Branch' },
      { path: 'customerId', model: 'Customer' }
    ]);

    return populatedTransactions;
  } catch (error) {
    console.error("Error fetching FD accounts:", error);
    return [];
  }
}

async function getAllFDPackage(date = null, branchId = null) {
  try {
    const query = {};

    // Set end of the provided date or today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = { $lte: endDate };

    // Filter by branch if branchId is provided
    if (branchId) {
      query.branchId = branchId;
    }

    const transactions = await FDAccount.find(query);
    const count = transactions.length;

    // const totalBalance = transactions.reduce((sum, tx) => sum + (tx.fdamount || 0), 0);

    return count
  } catch (error) {
    console.error("Error fetching FD accounts:", error);
    return { totalBalance: 0, count: 0 };
  }
}

async function getAllSBAccountWithdrawal(date = null, branchId = null) {
    let query = { package: 'SB', direction: 'Debit' };

     // Filter by date if provided or default to today
     const endDate = date ? new Date(date) : new Date();
     endDate.setHours(23, 59, 59, 999);
     query.createdAt = { $lte: endDate };

    if (branchId) {
        query.branchId = branchId;
    }


    const transactions = await AccountTransaction.find(query);

    // Sum up all withdrawal amounts directly
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return totalBalance;
}
async function getAllSBandDSAccount(date = null, branchId = null) {
    
  const DS = await getAllDSAccount(date,branchId)
  const SB = await getAllSBAccount(date,branchId)
  const FD = await getAllFDAccount(date,branchId)
  const totalContribution = DS + SB + FD
    
    return totalContribution;
}
async function getAllDailyDSAccount(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Credit' };
   // Filter by date if provided or default to today
   const targetDate = date ? new Date(date) : new Date();

   // Set start of day
   const startDate = new Date(targetDate);
   startDate.setHours(0, 0, 0, 0);
   
   // Set end of day
   const endDate = new Date(targetDate);
   endDate.setHours(23, 59, 59, 999);
   
   query.createdAt = { $gte: startDate, $lte: endDate };
   
    
    if (branchId) {
        query.branchId = branchId;
    }
    const transactions = await AccountTransaction.find(query);
    
 // Sum up all withdrawal amounts directly
 const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    
    // Calculate the sum of the latest balances
    // const totalBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0);
    //  const dswithdrawal = await getAllDailyDSAccountWithdrawalByDate(date,branchId) ;
    //  const charge = await getAllDailyDSAccountChargeByDate(date,branchId);
 

    // const Withdrawal = dswithdrawal + charge
    
    return totalBalance;
}
async function getAllDailyFDAccount(date = null, branchId = null) {
    let query = { package: 'FD', direction: 'Credit' };
   // Filter by date if provided or default to today
   const targetDate = date ? new Date(date) : new Date();

   // Set start of day
   const startDate = new Date(targetDate);
   startDate.setHours(0, 0, 0, 0);
   
   // Set end of day
   const endDate = new Date(targetDate);
   endDate.setHours(23, 59, 59, 999);
   
   query.createdAt = { $gte: startDate, $lte: endDate };
   
    
    if (branchId) {
        query.branchId = branchId;
    }
    const transactions = await AccountTransaction.find(query);
    
 // Sum up all withdrawal amounts directly
 const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    
    // Calculate the sum of the latest balances
    // const totalBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0);
    //  const dswithdrawal = await getAllDailyDSAccountWithdrawalByDate(date,branchId) ;
    //  const charge = await getAllDailyDSAccountChargeByDate(date,branchId);
 

    // const Withdrawal = dswithdrawal + charge
    
    return totalBalance;
}
async function getAllDailyDSAccountCharge(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Charge' };
    
    if (!date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: today, $lte: endOfToday };
    } else {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: startDate, $lte: endDate };
    }
    
    if (branchId) {
        query.branchId = branchId;
    }
    const transactions = await AccountTransaction.find(query);
    
    // Sort transactions by createdAt in ascending order
    transactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Use a Map to store the latest balance for each accountTypeId
    const balanceMap = new Map();
    
    transactions.forEach(tx => {
        balanceMap.set(tx.accountTypeId, tx.amount);
    });
    
    // Calculate the sum of the latest balances
    const totalBalance = Array.from(balanceMap.values()).reduce((sum, amount) => sum + amount, 0);
    
    return totalBalance;
}
async function getAllDailyDSAccountWithdrawal(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Debit' };
    
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
    
    if (branchId) {
        query.branchId = branchId;
    }
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
}
async function getAllDailyDSAccountChargeByDate(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Charge' };
    
   
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
    
  
    // Filter by branch if provided
    if (branchId) {
      query.branchId = branchId;
    }
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    return totalBalance;
}
async function getAllDailyDSAccountWithdrawalByDate(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Debit' };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
    
  
    // Filter by branch if provided
    if (branchId) {
      query.branchId = branchId;
    }
  
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
  }
  


async function getAllDailySBAccount(date = null, branchId = null) {
    let query = { package: 'SB', direction: 'Credit' };
    // Filter by date if provided or default to today
    const targetDate = date ? new Date(date) : new Date();
 
    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
    
     
     if (branchId) {
         query.branchId = branchId;
     }
     const transactions = await AccountTransaction.find(query);
    // return transactions
     // Sum up all withdrawal amounts directly
     const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    //   const sbwithdrawal = await getAllDailySBAccountWithdrawalByDate(date,branchId) ;
     
     return totalBalance  ;
}

async function getAllDailySBAccountWithdrawal(date = null, branchId = null) {
    
    let query = { package: 'SB', direction: 'Debit' };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
    
  
    // Filter by branch if provided
    if (branchId) {
      query.branchId = branchId;
    }
  
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
}
async function getAllDailySBAccountWithdrawalByDate(date = null, branchId = null) {
    let query = { package: 'SB', direction: 'Debit' };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
    
  
    // Filter by branch if provided
    if (branchId) {
      query.branchId = branchId;
    }
  
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
}
async function getSBAccountIncome(date = null, branchId = null) {
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
  
    const query = {
      package: 'SB',
      direction: 'Credit',
      createdAt: { $lte: endDate },
    };
  
    if (branchId) {
      query.branchId = branchId;
    }
  
    const transactions = await SureBankAccount.find(query);
  
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
  }
  

async function getDSAccountIncome(date = null, branchId = null) {
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
  
    const query = {
      package: 'DS',
      direction: 'Credit',
      createdAt: { $lte: endDate },
    };
  
    if (branchId) {
      query.branchId = branchId;
    }
  
    const transactions = await SureBankAccount.find(query);
  
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
  }
async function getFDAccountIncome(date = null, branchId = null) {
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
  
    const query = {
      package: 'FD',
      direction: 'Credit',
      createdAt: { $lte: endDate },
    };
  
    if (branchId) {
      query.branchId = branchId;
    }
  
    const transactions = await SureBankAccount.find(query);
  
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
  }
  
async function getAllSBandDSIncome(date = null, branchId = null) {

    const DS = await getDSAccountIncome(date,branchId)
    const SB = await getSBAccountIncome(date,branchId)
    const FD = await getFDAccountIncome(date,branchId)
    const totalContribution = DS + SB + FD
      
      return totalContribution;
  }

async function getAllDailySBandDSAccount(date = null, branchId = null) {

  const DS = await getAllDailyDSAccount(date,branchId)
  const SB = await getAllDailySBAccount(date,branchId)
  const totalContribution = DS + SB
    
    return totalContribution;
}

async function getAllDSAccountPackage(date = null, branchId = null) {
    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
    };
  
    // Optionally filter by branch
    if (branchId) {
      query.branchId = branchId;
    }
  
    // Count matching documents
    const countPackage = await DSAccount.countDocuments(query);
    return countPackage;
  }
  
  
async function getAllSBAccountPackage(date = null, branchId = null) {
    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
    };
  
    // Optionally filter by branch
    if (branchId) {
      query.branchId = branchId;
    }
  
    // Count matching documents
    const countPackage = await SBAccount.countDocuments(query);
    return countPackage;
}
async function getAllAccountPackage(date = null, branchId = null) {
const sbPackage = await getAllSBAccountPackage(date,branchId)    
const dsPackage = await getAllDSAccountPackage(date,branchId)    
const fdPackage = await getAllFDPackage(date,branchId)    
const packages = sbPackage + dsPackage + fdPackage
    return packages 
}
async function getAllExpenditure(date = null, branchId = null) {
    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
    };
  
    // Optionally filter by branch
    if (branchId) {
      query.branchId = branchId;
    }
  
    // Count matching documents
    const expenditures = await Expenditure.find(query);
  
    const totalExpenditure = expenditures.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalExpenditure;
}
async function getProfit(date = null, branchId = null) {
    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
    };
  
    // Optionally filter by branch
    if (branchId) {
      query.branchId = branchId;
    }
  
    // Count matching documents
    const income = await getAllSBandDSIncome(date,branchId)
    const expenditure = await getAllExpenditure(date,branchId)
  
    const profit = income - expenditure
  
    return profit;
}
const getSBIncomeReport = async () => {
    try {
      const report = await SureBankAccount.find({ package: 'SB' })
        .populate({
          path: 'customerId',
          populate: {
            path: 'branchId', 
            model: 'Branch'
          }
        });
  
      return report;
    } catch (error) {
      console.error('Error fetching SB income report:', error);
      throw new Error('Failed to retrieve SB income report');
    }
  };
const getDSIncomeReport = async () => {
    try {
      const report = await SureBankAccount.find({ package: 'DS' })
        .populate({
          path: 'customerId',
          populate: {
            path: 'branchId', 
            model: 'Branch'
          }
        });
  
      return report;
    } catch (error) {
      console.error('Error fetching DS income report:', error);
      throw new Error('Failed to retrieve SB income report');
    }
  };
const getExpenditureReport = async () => {
    try {
      const report = await Expenditure.find({})
        .populate({
          path: 'createdBy',
          populate: {
            path: 'branchId', 
            model: 'Branch'
          }
        }).sort({ createdAt: -1 });
  
      return report;
    } catch (error) {
      console.error('Error fetching DS income report:', error);
      throw new Error('Failed to retrieve SB income report');
    }
  };
  const getTransaction = async (createdBy) => {
    try {
      if (!createdBy) {
        throw new Error("createdBy is required");
      }
  
      // Fetch transactions and populate createdBy and customer details
      const transactions = await AccountTransaction.find({
        package: { $in: ['SB', 'DS'] }, // Match either 'SB' or 'DS'
        direction: { $in: ['Debit', 'Credit'] }, // Match either 'Debit' or 'Credit'
        createdBy, // Ensuring createdBy is always included
      })
        .populate({
          path: 'createdBy', // Populate createdBy to get branch details
          model: 'Staff'
        })
          .populate ({
            path: 'branchId',
            model: 'Branch',
          
        })
        .populate({
          path: 'customerId', // Populate customer details using customerId directly in AccountTransaction
          model: 'Customer',
        })
        .sort({ createdAt: -1 });
  
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw new Error('Failed to retrieve transactions');
    }
  };
  const getOrder = async () => {
    try {
  
      // Fetch transactions and populate createdBy and customer details
      const transactions = await SBAccount.find({})
        .populate({
          path: 'createdBy', // Populate createdBy to get branch details
          model: 'Staff'
        })
          .populate ({
            path: 'branchId',
            model: 'Branch',
          
        })
        .populate({
          path: 'customerId', // Populate customer details using customerId directly in AccountTransaction
          model: 'Customer',
        })
        .sort({ status: 1 }); // Sort alphabetically (but not guaranteed for "booked" first)

    // Custom sorting: "booked" first, then "sold"
    transactions.sort((a, b) => (a.status === "booked" ? -1 : 1));
  
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw new Error('Failed to retrieve transactions');
    }
  };
  
  
  

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
    getAllDailyDSAccountChargeByDate,
    getAllDailyDSAccountWithdrawalByDate,
    getAllDailySBAccountWithdrawalByDate,
    getAllSBandDSAccount,
    getAllDailyDSAccount,
    getAllDailyFDAccount,
    getAllDailyDSAccountCharge,
    getAllDailyDSAccountWithdrawal,
    getAllDailySBAccount,
    getAllDailySBAccountWithdrawal,
    getAllDailySBandDSAccount,
    getAllDSAccountPackage,
    getAllSBAccountPackage,
    getAllAccountPackage,
    getSBAccountIncome,
    getDSAccountIncome,
    getFDAccountIncome,
    getAllSBandDSIncome,
    getAllExpenditure,
    getProfit,
    getSBIncomeReport,
    getDSIncomeReport,
    getExpenditureReport,
    getTransaction,
    getOrder,
  };