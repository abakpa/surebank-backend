const Account = require('../../../Account/Model/index');
const AccountTransaction = require('../../../AccountTransaction/Model/index');
const DSAccount = require('../../../DSAccount/Model');
const SBAccount = require('../../../SBAccount/Model');
const SureBankAccount = require('../../../SureBankAccount/Model');
const Expenditure = require('../../../Expenditure/Model');
const FDAccount = require('../../../FDAccount/Model');
const Order = require('../../../SBAccount/Model/order');
const EcommerceOrder = require('../../../EcommerceOrder/Model');
const Product = require('../../../Product/Model');
const Branch = require('../../../Branch/Model');
const Customer = require('../../../Customer/Model');
const Staff = require('../../../Staff/Model');

const normalizeDateInput = (dateInput) => {
  if (dateInput && typeof dateInput === 'object' && !Array.isArray(dateInput)) {
    return {
      date: dateInput.date || '',
      startDate: dateInput.startDate || '',
      endDate: dateInput.endDate || '',
    };
  }

  return { date: dateInput || '', startDate: '', endDate: '' };
};

const getStartOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getEndOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const buildCumulativeCreatedAtQuery = (dateInput) => {
  const { date, startDate, endDate } = normalizeDateInput(dateInput);

  if (startDate || endDate) {
    const createdAt = {};
    if (startDate) {
      createdAt.$gte = getStartOfDay(startDate);
    }
    createdAt.$lte = endDate ? getEndOfDay(endDate) : getEndOfDay(new Date());
    return createdAt;
  }

  return { $lte: date ? getEndOfDay(date) : getEndOfDay(new Date()) };
};

const buildDailyCreatedAtQuery = (dateInput) => {
  const { date, startDate, endDate } = normalizeDateInput(dateInput);

  if (startDate || endDate) {
    const createdAt = {};
    if (startDate) {
      createdAt.$gte = getStartOfDay(startDate);
    }
    createdAt.$lte = endDate ? getEndOfDay(endDate) : getEndOfDay(new Date());
    return createdAt;
  }

  const effectiveDate = date || new Date();
  return {
    $gte: getStartOfDay(effectiveDate),
    $lte: getEndOfDay(effectiveDate),
  };
};
const mongoose = require('mongoose');

const ECOMMERCE_DEPOSIT_NARRATION_PATTERN = /^(Wallet Funding|Order Payment to Wallet)/i;
const STAFF_STATS_QUERY_FILTER = { $ne: true };

const buildEcommerceDepositTransactionQuery = ({ date = null, branchId = null, createdBy = null } = {}) => {
  const query = {
    package: 'Wallet',
    direction: 'Credit',
    narration: { $regex: ECOMMERCE_DEPOSIT_NARRATION_PATTERN }
  };

  const endDate = date ? new Date(date) : new Date();
  endDate.setHours(23, 59, 59, 999);
  query.createdAt = buildCumulativeCreatedAtQuery(date);

  if (branchId) {
    query.branchId = branchId;
  }

  if (createdBy) {
    query.createdBy = createdBy;
  }

  return query;
};

const formatStaffName = (staff) => {
  if (!staff) return 'Ecommerce';
  return `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'Ecommerce';
};

const formatCustomerName = (customer) => {
  if (!customer) return 'N/A';
  return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.phone || 'N/A';
};

const isValidObjectId = (value) => {
  if (!value || typeof value !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(value);
};


async function getAllAvailableBalance(date = null, branchId = null) {
  try {
    let query = {}; // base query for DSAccount

    // Filter by date if provided or default to today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = buildCumulativeCreatedAtQuery(date);

    // Filter by branchId if provided
    if (branchId) {
      query.branchId = branchId;
    }

    // Aggregate total contribution
    const result = await Account.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          availableBalance: { $sum: "$availableBalance" }
        }
      }
    ]);

    return result[0]?.availableBalance || 0;
  } catch (error) {
    console.error("Error calculating total DSAccount contribution:", error);
    throw new Error("Failed to calculate total DSAccount contribution");
  }
}
async function getAllDSAccount(date = null, branchId = null) {
  try {
    let query = {}; // base query for DSAccount

    // Filter by date if provided or default to today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = buildCumulativeCreatedAtQuery(date);

    // Filter by branchId if provided
    if (branchId) {
      query.branchId = branchId;
    }

    // Aggregate total contribution
    const result = await DSAccount.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalContribution: { $sum: "$totalContribution" }
        }
      }
    ]);

    return result[0]?.totalContribution || 0;
  } catch (error) {
    console.error("Error calculating total DSAccount contribution:", error);
    throw new Error("Failed to calculate total DSAccount contribution");
  }
}
async function getAllDSAccountWithdrawal(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Debit', excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };

     // Filter by date if provided or default to today
     const endDate = date ? new Date(date) : new Date();
     endDate.setHours(23, 59, 59, 999);
     query.createdAt = buildCumulativeCreatedAtQuery(date);

    if (branchId) {
        query.branchId = branchId;
    }


    const transactions = await AccountTransaction.find(query);
    // return transactions

    // Sum up all withdrawal amounts directly
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;

     

    return totalBalance;
}


async function getAllDSAccountCharge(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Charge', excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
       // Filter by date if provided or default to today
       const endDate = date ? new Date(date) : new Date();
       endDate.setHours(23, 59, 59, 999);
       query.createdAt = buildCumulativeCreatedAtQuery(date);
     
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
  try {
    let query = {}; // base query for DSAccount

    // Filter by date if provided or default to today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = buildCumulativeCreatedAtQuery(date);

    // Filter by branchId if provided
    if (branchId) {
      query.branchId = branchId;
    }

    // Aggregate total contribution
    const result = await SBAccount.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          balance: { $sum: "$balance" }
        }
      }
    ]);

    return result[0]?.balance || 0;
  } catch (error) {
    console.error("Error calculating total DSAccount contribution:", error);
    throw new Error("Failed to calculate total DSAccount contribution");
  }
}
async function getAllFDAccount(date = null, branchId = null) {
  try {
    const query = {
      status: { $in: ['Active', 'Matured'] } // ✅ Correct way to match multiple values
    };

    // ✅ Use the end of the given date or today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = buildCumulativeCreatedAtQuery(date);

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
    query.createdAt = buildCumulativeCreatedAtQuery(date);

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
    query.createdAt = buildCumulativeCreatedAtQuery(date);

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
    query.createdAt = buildCumulativeCreatedAtQuery(date);

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
     query.createdAt = buildCumulativeCreatedAtQuery(date);

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
    let query = { package: 'DS', direction: 'Credit', excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
   // Filter by date if provided or default to today
   const targetDate = date ? new Date(date) : new Date();

   // Set start of day
   const startDate = new Date(targetDate);
   startDate.setHours(0, 0, 0, 0);
   
   // Set end of day
   const endDate = new Date(targetDate);
   endDate.setHours(23, 59, 59, 999);
   
   query.createdAt = buildDailyCreatedAtQuery(date);
   
    
    if (branchId) {
        query.branchId = branchId;
    }
    const transactions = await AccountTransaction.find(query);
    
 // Sum up all withdrawal amounts directly
 const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
   // Step 2: Get reversal total
    const reversalTotal = await getDailyReversalTotal(date, branchId);

    // Step 3: Subtract reversals
    const totalBalance1 = totalBalance - reversalTotal;

    return totalBalance1;
    
    // Calculate the sum of the latest balances
    // const totalBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0);
    //  const dswithdrawal = await getAllDailyDSAccountWithdrawalByDate(date,branchId) ;
    //  const charge = await getAllDailyDSAccountChargeByDate(date,branchId);
 

    // const Withdrawal = dswithdrawal + charge
    
    // return totalBalance;
}

// Function to fetch and calculate reversal total
async function getReversalTotal(date = null, branchId = null) {
  let query = { 
  package: 'DS', 
  direction: 'Debit', 
  narration: 'Reversal',
  excludeFromStaffStats: STAFF_STATS_QUERY_FILTER
};

    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);

    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    query.createdAt = buildDailyCreatedAtQuery(date);

    if (branchId) {
        query.branchId = branchId;
    }

    // Only fetch reversal transactions
    // query.narration = { $regex: /^reversal$/i }; // case-insensitive match

    const reversalTransactions = await AccountTransaction.find(query);
    const reversalTotal = reversalTransactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    return reversalTotal;
}
async function getDailyReversalTotal(date = null, branchId = null) {
  let query = { 
  package: 'DS', 
  direction: { $in: ['Debit', 'Credit'] }, 
  narration: 'Reversal',
  excludeFromStaffStats: STAFF_STATS_QUERY_FILTER
};

    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);

    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    query.createdAt = buildDailyCreatedAtQuery(date);

    if (branchId) {
        query.branchId = branchId;
    }

    // Only fetch reversal transactions
    // query.narration = { $regex: /^reversal$/i }; // case-insensitive match

    const reversalTransactions = await AccountTransaction.find(query);
    const reversalTotal = reversalTransactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    return reversalTotal;
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
   
   query.createdAt = buildDailyCreatedAtQuery(date);
   
    
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
    let query = { package: 'DS', direction: 'Charge', excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
    query.createdAt = buildDailyCreatedAtQuery(date);
    
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
    let query = { package: 'DS', direction: 'Debit', excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
    
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = buildDailyCreatedAtQuery(date);
    
    if (branchId) {
        query.branchId = branchId;
    }
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);

      const reversalTotal = await getReversalTotal(date, branchId);
    // Step 3: Subtract reversals
    const totalBalance1 = totalBalance - reversalTotal;
    // console.log("LLLLL",transactions)

    return totalBalance1;
  
    // return totalBalance;
}
async function getAllDailyDSAccountChargeByDate(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Charge', excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
    
   
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = buildDailyCreatedAtQuery(date);
    
  
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
    let query = { package: 'DS', direction: 'Debit', excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = buildDailyCreatedAtQuery(date);
    
  
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
    let query = { package: 'SB', direction: 'Credit', excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
    // Filter by date if provided or default to today
    const targetDate = date ? new Date(date) : new Date();
 
    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = buildDailyCreatedAtQuery(date);
    
     
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
    
    let query = { package: 'SB', direction: 'Debit', excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = buildDailyCreatedAtQuery(date);
    
  
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
    let query = { package: 'SB', direction: 'Debit', excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = buildDailyCreatedAtQuery(date);
    
  
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
  
    const totalBalance1 = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    const dsIncomeReversal = await getDSAccountIncomeReversal(date,branchId)

    const totalBalance = totalBalance1 - dsIncomeReversal
  
    return totalBalance;
  }
async function getDSAccountIncomeReversal(date = null, branchId = null) {
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
  
    const query = {
      package: 'DS',
      direction: 'Debit',
      narration: 'DS Charge Reversal',
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
    const ecommerce = await getEcommerceIncome(date,branchId)
    const totalContribution = DS + SB + FD + ecommerce

      return totalContribution;
  }

async function getAllDailySBandDSAccount(date = null, branchId = null) {

  const DS = await getAllDailyDSAccount(date,branchId)
  const SB = await getAllDailySBAccount(date,branchId)
  const FD = await getAllDailyFDAccount(date,branchId)
  const totalContribution = DS + SB + FD
    
    return totalContribution;
}

async function getAllDSAccountPackage(date = null, branchId = null) {
    const query = {
      createdAt: buildCumulativeCreatedAtQuery(date),
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
    const query = {
      createdAt: buildCumulativeCreatedAtQuery(date),
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
    const query = {
      createdAt: buildCumulativeCreatedAtQuery(date),
      status: 1, // Only fetch active expenditures
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
const deleteExpenditure = async (expenditureId) => {
  try {
    const result = await Expenditure.findByIdAndUpdate(
      expenditureId,
      { status: 0 },
      { new: true } // return the updated document
    );

    if (!result) {
      throw new Error("Expenditure not found");
    }

    return result;
  } catch (error) {
    console.error("Error deleting expenditure:", error);
    throw new Error("Failed to delete expenditure");
  }
};

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

    // Total income already includes ecommerce income (from getAllSBandDSIncome)
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
      const report = await Expenditure.find({status: 1})
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
        package: { $in: ['SB', 'DS','FD'] }, // Match either 'SB' or 'DS'
        direction: { $in: ['Debit', 'Credit'] }, // Match either 'Debit' or 'Credit'
        excludeFromStaffStats: STAFF_STATS_QUERY_FILTER,
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
  const getOrder = async ({ page = 1, limit = 25, search = '' } = {}) => {
    const mongoose = require('mongoose');
    const normalizeOrderStatus = ({ status, paymentStatus }) => {
      const normalizedStatus = String(status || '').toLowerCase();
      const normalizedPaymentStatus = String(paymentStatus || '').toLowerCase();

      if (normalizedPaymentStatus === 'paid') {
        return 'paid';
      }

      if (['paid', 'sold'].includes(normalizedStatus)) {
        return 'paid';
      }

      return 'booked';
    };
    const getEcommerceProductName = (order, fallbackAccount) => {
      const itemNames = Array.isArray(order.items)
        ? order.items
            .map((item) => item?.productName || item?.name || '')
            .filter(Boolean)
        : [];

      if (itemNames.length > 0) {
        return itemNames.join(', ');
      }

      return fallbackAccount?.productName || 'E-Commerce Order';
    };
    const getEcommerceSellingPrice = (order, fallbackAccount) => {
      const totalAmount = Number(order.totalAmount || 0);
      if (totalAmount > 0) {
        return totalAmount;
      }

      return Number(fallbackAccount?.sellingPrice || 0);
    };

    const isValidObjectId = (value) => {
      if (!value) return false;
      if (typeof value !== 'string') return false;
      if (value === 'ECOMMERCE_SYSTEM' || value === '') return false;
      return mongoose.Types.ObjectId.isValid(value);
    };

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const trimmedSearch = search.trim().toLowerCase();

    try {
      const orderProjection = '_id customerId branchId accountManagerId productName sellingPrice status createdAt';
      const sbAccountProjection = '_id customerId branchId accountManagerId productName productDescription sellingPrice status createdAt SBAccountNumber createdBy';
      const ecommerceOrderProjection = '_id customerId branchId accountManagerId items totalAmount status paymentStatus createdAt SBAccountNumber';
      const [orders, sbAccounts, ecommerceOrders] = await Promise.all([
        Order.find({}).select(orderProjection).lean(),
        SBAccount.find({}).select(sbAccountProjection).lean(),
        EcommerceOrder.find({}).select(ecommerceOrderProjection).lean(),
      ]);

      const ecommerceSbAccountNumbers = new Set(
        ecommerceOrders
          .map((order) => order.SBAccountNumber)
          .filter(Boolean)
      );
      const sbAccountMap = new Map(
        sbAccounts
          .filter((account) => account.SBAccountNumber)
          .map((account) => [account.SBAccountNumber, account])
      );

      const normalizedEcommerceOrders = ecommerceOrders.map((order) => {
        const fallbackAccount = order.SBAccountNumber
          ? sbAccountMap.get(order.SBAccountNumber)
          : null;

        return {
          _id: order._id,
          customerId: order.customerId,
          branchId: order.branchId,
          accountManagerId: order.accountManagerId || 'ECOMMERCE_SYSTEM',
          productName: getEcommerceProductName(order, fallbackAccount),
          sellingPrice: getEcommerceSellingPrice(order, fallbackAccount),
          status: normalizeOrderStatus(order),
          createdAt: order.createdAt,
        };
      });

      const filteredSbAccounts = sbAccounts.filter((account) => {
        const isEcommerceDefaultAccount =
          account.createdBy === 'ECOMMERCE_SYSTEM' &&
          account.productDescription === 'Default SB Account for e-commerce customers';

        return !ecommerceSbAccountNumbers.has(account.SBAccountNumber) && !isEcommerceDefaultAccount;
      });

      const combined = [...orders, ...filteredSbAccounts, ...normalizedEcommerceOrders];
      const branchIds = [...new Set(
        combined
          .map((item) => item.branchId)
          .filter((value) => isValidObjectId(value))
      )];
      const customerIds = [...new Set(
        combined
          .map((item) => item.customerId)
          .filter((value) => isValidObjectId(value))
      )];
      const staffIds = [...new Set(
        combined
          .map((item) => item.accountManagerId)
          .filter((value) => isValidObjectId(value))
      )];

      const [branches, customers, staffList] = await Promise.all([
        Branch.find({ _id: { $in: branchIds } }).select('_id name').lean(),
        Customer.find({ _id: { $in: customerIds } }).select('_id firstName lastName').lean(),
        Staff.find({ _id: { $in: staffIds } }).select('_id firstName lastName').lean(),
      ]);

      const branchMap = new Map(branches.map((branch) => [branch._id.toString(), branch]));
      const customerMap = new Map(customers.map((customer) => [customer._id.toString(), customer]));
      const staffMap = new Map(staffList.map((staff) => [staff._id.toString(), staff]));

      const normalizedItems = combined.map((item) => {
        const customer = customerMap.get(item.customerId?.toString()) || null;
        const branch = branchMap.get(item.branchId?.toString()) || null;
        let accountManager = item.accountManagerId;

        if (isValidObjectId(item.accountManagerId)) {
          accountManager = staffMap.get(item.accountManagerId.toString()) || item.accountManagerId;
        }

        return {
          _id: item._id,
          customerId: customer,
          branchId: branch,
          accountManagerId: accountManager,
          productName: item.productName,
          sellingPrice: item.sellingPrice,
          status: normalizeOrderStatus(item),
          createdAt: item.createdAt,
        };
      });

      const filteredItems = trimmedSearch
        ? normalizedItems.filter((item) => {
            const customerName = `${item.customerId?.firstName || ''} ${item.customerId?.lastName || ''}`.trim().toLowerCase();
            const branchName = (item.branchId?.name || '').toLowerCase();
            const productName = (item.productName || '').toLowerCase();
            const status = (item.status || '').toLowerCase();

            return (
              customerName.includes(trimmedSearch) ||
              branchName.includes(trimmedSearch) ||
              productName.includes(trimmedSearch) ||
              status.includes(trimmedSearch)
            );
          })
        : normalizedItems;

      const statusPriority = {
        booked: 0,
        paid: 1,
      };

      filteredItems.sort((a, b) => {
        const priorityA = statusPriority[a.status] ?? 99;
        const priorityB = statusPriority[b.status] ?? 99;

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      const total = filteredItems.length;
      const items = filteredItems.slice((safePage - 1) * safeLimit, safePage * safeLimit);

      return {
        items,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(Math.ceil(total / safeLimit), 1),
      };
    } catch (error) {
      console.error('Error fetching data:', error);
      throw new Error('Failed to retrieve orders');
    }
  };
  
  
  

async function getEcommerceIncome(date = null, branchId = null) {
  try {
    // Build query for paid ecommerce orders
    const query = {
      paymentStatus: 'paid'
    };

    // Filter by date if provided or default to today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = buildCumulativeCreatedAtQuery(date);

    // Filter by branchId if provided
    if (branchId) {
      query.branchId = branchId;
    }

    // Fetch all paid ecommerce orders
    const orders = await EcommerceOrder.find(query);

    // Calculate total profit from all order items
    let totalProfit = 0;

    for (const order of orders) {
      for (const item of order.items) {
        // Look up the product to get its profit
        const product = await Product.findById(item.productId);
        if (product && product.profit) {
          // Multiply profit per unit by quantity ordered
          totalProfit += product.profit * item.quantity;
        }
      }
    }

    return totalProfit;
  } catch (error) {
    console.error("Error calculating ecommerce income:", error);
    return 0;
  }
}

async function getDailyEcommerceIncome(date = null, branchId = null) {
  try {
    // Filter by specific day
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);

    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    // Build query for paid ecommerce orders
    const query = {
      paymentStatus: 'paid',
      createdAt: { $gte: startDate, $lte: endDate }
    };

    // Filter by branchId if provided
    if (branchId) {
      query.branchId = branchId;
    }

    // Fetch paid ecommerce orders for the day
    const orders = await EcommerceOrder.find(query);

    // Calculate total profit from all order items
    let totalProfit = 0;

    for (const order of orders) {
      for (const item of order.items) {
        // Look up the product to get its profit
        const product = await Product.findById(item.productId);
        if (product && product.profit) {
          // Multiply profit per unit by quantity ordered
          totalProfit += product.profit * item.quantity;
        }
      }
    }

    return totalProfit;
  } catch (error) {
    console.error("Error calculating daily ecommerce income:", error);
    return 0;
  }
}

async function getEcommerceIncomeReport(date = null, branchId = null) {
  try {
    // Build query for paid ecommerce orders
    const query = {
      paymentStatus: 'paid'
    };

    // Filter by date if provided
    if (date) {
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt = buildCumulativeCreatedAtQuery(date);
    }

    // Filter by branchId if provided
    if (branchId) {
      query.branchId = branchId;
    }

    // Fetch all paid ecommerce orders with customer details
    const orders = await EcommerceOrder.find(query)
      .populate({ path: 'customerId', model: 'Customer' })
      .sort({ createdAt: -1 });

    // Build report data
    const reportData = [];

    for (const order of orders) {
      // Calculate profit for this order
      let orderProfit = 0;
      const productNames = [];

      for (const item of order.items) {
        // Look up the product to get its profit
        const product = await Product.findById(item.productId);
        if (product && product.profit) {
          orderProfit += product.profit * item.quantity;
        }
        productNames.push(item.productName);
      }

      reportData.push({
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerId
          ? `${order.customerId.firstName || ''} ${order.customerId.lastName || ''}`.trim()
          : 'N/A',
        productNames: productNames.join(', '),
        profit: orderProfit,
        soldDate: order.updatedAt || order.createdAt,
        branchId: order.branchId
      });
    }

    return reportData;
  } catch (error) {
    console.error("Error fetching ecommerce income report:", error);
    return [];
  }
}

async function getEcommerceDeposit(date = null, branchId = null) {
  try {
    const query = buildEcommerceDepositTransactionQuery({ date, branchId });
    const transactions = await AccountTransaction.find(query).select('amount').lean();
    return transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  } catch (error) {
    console.error('Error calculating ecommerce deposit:', error);
    return 0;
  }
}

async function getEcommerceDepositReport(date = null, branchId = null) {
  try {
    const query = buildEcommerceDepositTransactionQuery({ date, branchId });
    const transactions = await AccountTransaction.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const customerIds = [...new Set(
      transactions
        .map((transaction) => transaction.customerId?.toString())
        .filter(isValidObjectId)
    )];
    const branchIds = [...new Set(
      transactions
        .map((transaction) => transaction.branchId?.toString())
        .filter(isValidObjectId)
    )];
    const staffIds = [...new Set(
      transactions
        .map((transaction) => transaction.createdBy?.toString())
        .filter(isValidObjectId)
    )];

    const [customers, branches, staffList] = await Promise.all([
      Customer.find({ _id: { $in: customerIds } }).select('_id firstName lastName phone').lean(),
      Branch.find({ _id: { $in: branchIds } }).select('_id name').lean(),
      Staff.find({ _id: { $in: staffIds } }).select('_id firstName lastName').lean(),
    ]);

    const customerMap = new Map(customers.map((customer) => [customer._id.toString(), customer]));
    const branchMap = new Map(branches.map((branch) => [branch._id.toString(), branch]));
    const staffMap = new Map(staffList.map((staff) => [staff._id.toString(), staff]));

    return transactions.map((transaction) => ({
      _id: transaction._id,
      customerName: formatCustomerName(customerMap.get(transaction.customerId?.toString()) || null),
      narration: transaction.narration,
      amount: Number(transaction.amount || 0),
      date: transaction.createdAt,
      branchName: branchMap.get(transaction.branchId?.toString())?.name || 'N/A',
      staffName: formatStaffName(staffMap.get(transaction.createdBy?.toString()) || null),
    }));
  } catch (error) {
    console.error('Error fetching ecommerce deposit report:', error);
    return [];
  }
}

  module.exports = {
    getAllAvailableBalance,
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
    getReversalTotal,
    getDailyReversalTotal,
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
    getDSAccountIncomeReversal,
    getFDAccountIncome,
    getAllSBandDSIncome,
    getAllExpenditure,
    deleteExpenditure,
    getProfit,
    getSBIncomeReport,
    getDSIncomeReport,
    getExpenditureReport,
    getTransaction,
    getOrder,
    getEcommerceIncome,
    getDailyEcommerceIncome,
    getEcommerceIncomeReport,
    getEcommerceDeposit,
    getEcommerceDepositReport,
  };
