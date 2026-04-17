const Account = require('../../../Account/Model/index');
const AccountTransaction = require('../../../AccountTransaction/Model/index');
const DSAccount = require('../../../DSAccount/Model');
const SBAccount = require('../../../SBAccount/Model');
const mongoose = require('mongoose');
const SureBankAccount = require('../../../SureBankAccount/Model');
const Expenditure = require('../../../Expenditure/Model');
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
const Customer = require('../../../Customer/Model');
const FDAccount = require('../../../FDAccount/Model');
const Order = require('../../../SBAccount/Model/order');
const EcommerceOrder = require('../../../EcommerceOrder/Model');

const ECOMMERCE_DEPOSIT_NARRATION_PATTERN = /^(Wallet Funding|Order Payment to Wallet)/i;
const STAFF_STATS_QUERY_FILTER = { $ne: true };

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



async function getAllBranchDSAccount(date = null, staff) {

    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'DS', direction: 'Credit',branchId:branchId, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
    
   
    // Filter by date if provided or default to today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = buildCumulativeCreatedAtQuery(date);
  
    const transactions = await AccountTransaction.find(query);
    
    // // Sort transactions by createdAt in ascending order
    // transactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // // Use a Map to store the latest balance for each accountTypeId
    // const balanceMap = new Map();
    
    // transactions.forEach(tx => {
    //     balanceMap.set(tx.accountTypeId, tx.balance);
    // });
    
    // Calculate the sum of the latest balances
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    // const totalBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0);
    const dswithdrawal = await getAllBranchDSAccountWithdrawal(date,staff);
    const charge  = await getAllBranchDSAccountCharge(date,staff);
    const Withdrawal = dswithdrawal + charge
    
    return totalBalance - Withdrawal;
}
async function getAllBranchDSAccountWithdrawal(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'DS', direction: 'Debit',branchId:branchId, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };

     // Filter by date if provided or default to today
     const endDate = date ? new Date(date) : new Date();
     endDate.setHours(23, 59, 59, 999);
     query.createdAt = buildCumulativeCreatedAtQuery(date);


    const transactions = await AccountTransaction.find(query);

    // Sum up all withdrawal amounts directly
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return totalBalance;
}


async function getAllBranchDSAccountCharge(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'DS', direction: 'Charge',branchId, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
       // Filter by date if provided or default to today
       const endDate = date ? new Date(date) : new Date();
       endDate.setHours(23, 59, 59, 999);
       query.createdAt = buildCumulativeCreatedAtQuery(date);
     
    const transactions = await AccountTransaction.find(query);
    
   // Sum up all charge amounts directly
   const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    
    return totalBalance;
}

async function getAllBranchSBAccount(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'SB', direction: 'Credit',branchId:branchId, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
    
   
    // Filter by date if provided or default to today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = buildCumulativeCreatedAtQuery(date);
  
  
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
    const SBWithdrawal = await getAllBranchSBAccountWithdrawal(date,staff)
    
    return totalBalance - SBWithdrawal;
}
async function getAllFDAccount(date = null, staff) {
  const branch = await Staff.findOne({_id:staff})
  const branchId = branch.branchId
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

    const totalBalance = transactions.reduce((sum, tx) => sum + (tx.fdamount || 0), 0);

    return totalBalance
  } catch (error) {
    console.error("Error fetching FD accounts:", error);
    return totalBalance = 0
  }
}
async function getAllFDInterestIncome(date = null, staff) {
  const branch = await Staff.findOne({_id:staff})
  const branchId = branch.branchId
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

    const totalBalance = transactions.reduce((sum, tx) => sum + (tx.incomeInterest || 0), 0);

    return totalBalance
  } catch (error) {
    console.error("Error fetching FD accounts:", error);
    return totalBalance = 0
  }
}
async function getAllFDInterestExpense(date = null, staff) {
  const branch = await Staff.findOne({_id:staff})
  const branchId = branch.branchId
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

    const totalBalance = transactions.reduce((sum, tx) => sum + (tx.expenseInterest || 0), 0);

    return totalBalance
  } catch (error) {
    console.error("Error fetching FD accounts:", error);
    return totalBalance = 0
  }
}
async function getAllFDTransaction(date = null, staff) {
  const branch = await Staff.findOne({_id:staff})
  const branchId = branch.branchId
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

    const transactions = await FDAccount.find(query)
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

    // const totalBalance = transactions.reduce((sum, tx) => sum + (tx.expenseInterest || 0), 0);
    return transactions
  } catch (error) {
    console.error("Error fetching FD accounts:", error);
    return totalBalance = 0
  }
}
async function getAllFDPackage(date = null, staff) {
  const branch = await Staff.findOne({_id:staff})
  const branchId = branch.branchId
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
async function getAllBranchSBAccountWithdrawal(date = null, staff ) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'SB', direction: 'Debit',branchId:branchId };

     // Filter by date if provided or default to today
     const endDate = date ? new Date(date) : new Date();
     endDate.setHours(23, 59, 59, 999);
     query.createdAt = buildCumulativeCreatedAtQuery(date);


    const transactions = await AccountTransaction.find(query);

    // Sum up all withdrawal amounts directly
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return totalBalance;
}
async function getAllBranchSBandDSAccount(date = null, staff) {

  const DS = await getAllBranchDSAccount(date,staff)
  const SB = await getAllBranchSBAccount(date,staff)
  const totalContribution = DS + SB
    
    return totalContribution;
}
async function getAllBranchDailyDSAccount(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'DS', direction: 'Credit',branchId:branchId, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
   // Filter by date if provided or default to today
   const targetDate = date ? new Date(date) : new Date();

   // Set start of day
   const startDate = new Date(targetDate);
   startDate.setHours(0, 0, 0, 0);
   
   // Set end of day
   const endDate = new Date(targetDate);
   endDate.setHours(23, 59, 59, 999);
   
   query.createdAt = buildDailyCreatedAtQuery(date);

    const transactions = await AccountTransaction.find(query);
    
 // Sum up all withdrawal amounts directly
 const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
  // Sum up all withdrawal amounts directly
  // const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    // Step 2: Get reversal total
     const reversalTotal = await getDailyReversalTotal(date, branchId);
 
     // Step 3: Subtract reversals
     const totalBalance1 = totalBalance - reversalTotal;
 
     return totalBalance1;
    
    // Calculate the sum of the latest balances
    // const totalBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0);
    //  const dswithdrawal = await getAllBranchDailyDSAccountWithdrawalByDate(date,staff) ;
    //  const charge = await getAllBranchDailyDSAccountChargeByDate(date,staff);
 

    // const Withdrawal = dswithdrawal + charge
    
    // return totalBalance  ;
}
async function getAllBranchDailyFDAccount(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'FD', direction: 'Credit',branchId:branchId };
   // Filter by date if provided or default to today
   const targetDate = date ? new Date(date) : new Date();

   // Set start of day
   const startDate = new Date(targetDate);
   startDate.setHours(0, 0, 0, 0);
   
   // Set end of day
   const endDate = new Date(targetDate);
   endDate.setHours(23, 59, 59, 999);
   
   query.createdAt = buildDailyCreatedAtQuery(date);

    const transactions = await AccountTransaction.find(query);
    
 // Sum up all withdrawal amounts directly
 const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    
    // Calculate the sum of the latest balances
    // const totalBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0);
    //  const dswithdrawal = await getAllBranchDailyDSAccountWithdrawalByDate(date,staff) ;
    //  const charge = await getAllBranchDailyDSAccountChargeByDate(date,staff);
 

    // const Withdrawal = dswithdrawal + charge
    
    return totalBalance  ;
}
async function getAllBranchDailyDSAccountChargeByDate(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'DS', direction: 'Charge',branchId:branchId, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
    
   
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = buildDailyCreatedAtQuery(date);
    

  
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    return totalBalance;
}
async function getAllBranchDailyDSAccountWithdrawalByDate(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'DS', direction: 'Debit',branchId:branchId, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = buildDailyCreatedAtQuery(date);
    

  
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
  }
  async function getAllBranchDailySBAccount(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'SB', direction: 'Credit',branchId:branchId, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
    // Filter by date if provided or default to today
    const targetDate = date ? new Date(date) : new Date();
 
    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = buildDailyCreatedAtQuery(date);
    
     
  
     const transactions = await AccountTransaction.find(query);
    // return transactions
     // Sum up all withdrawal amounts directly
     const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    //   const sbwithdrawal = await getAllDailySBAccountWithdrawalByDate(date,branchId) ;
     
     return totalBalance  ;
}

async function getAllBranchDailySBAccountWithdrawal(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'SB', direction: 'Debit',branchId:branchId, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = buildDailyCreatedAtQuery(date);
    
  
 
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
}
async function getAllBranchDailyDSAccountWithdrawal(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'DS', direction: 'Debit',branchId:branchId, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = buildDailyCreatedAtQuery(date);
    
  
 
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
 
       const reversalTotal = await getReversalTotal(date, branchId);
     // Step 3: Subtract reversals
     const totalBalance1 = totalBalance - reversalTotal;
     // console.log("LLLLL",transactions)
 
     return totalBalance1;
}
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
async function getAllBranchDailySBandDSAccount(date = null, staff) {

  const DS = await getAllBranchDailyDSAccount(date,staff)
  const SB = await getAllBranchDailySBAccount(date,staff)
  const FD = await getAllBranchDailyFDAccount(date,staff)
  const totalContribution = DS + SB + FD
    
    return totalContribution;
}
async function getAllBranchDSAccountPackage(date = null, staff) {
  const branch = await Staff.findOne({_id:staff})
  const branchId = branch.branchId
    const query = {
      createdAt: buildCumulativeCreatedAtQuery(date),
      branchId:branchId
    };
  
    // Optionally filter by branch
    // if (branchId) {
    //   query.branchId = branchId;
    // }
  
    // Count matching documents
    const countPackage = await DSAccount.countDocuments(query);
    return countPackage;
  }
  
  
async function getAllBranchSBAccountPackage(date = null, staff) {
  const branch = await Staff.findOne({_id:staff})
  const branchId = branch.branchId
    const query = {
      createdAt: buildCumulativeCreatedAtQuery(date),
      branchId:branchId
    };
  
    // Optionally filter by branch
    // if (branchId) {
    //   query.branchId = branchId;
    // }
  
    // Count matching documents
    const countPackage = await SBAccount.countDocuments(query);
    return countPackage;
}
async function getAllBranchAccountPackage(date = null, staff) {
const sbPackage = await getAllBranchSBAccountPackage(date,staff)    
const dsPackage = await getAllBranchDSAccountPackage(date,staff)    
const fdPackage = await getAllFDPackage(date,staff)    
const packages = sbPackage + dsPackage + fdPackage
    return packages 
}
async function getBranchSBAccountIncome(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
  
    const query = {
      package: 'SB',
      direction: 'Credit',
      createdAt: { $lte: endDate },
      branchId:branchId
    };
  
    // if (branchId) {
    //   query.branchId = branchId;
    // }
  
    const transactions = await SureBankAccount.find(query);
  
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
  }
  

async function getBranchDSAccountIncome(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
  
    const query = {
      package: 'DS',
      direction: 'Credit',
      createdAt: { $lte: endDate },
      branchId:branchId
    };
  
    // if (branchId) {
    //   query.branchId = branchId;
    // }
  
    const transactions = await SureBankAccount.find(query);
  
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
  }
  
async function getBranchAllSBandDSIncome(date = null, staff) {

    const DS = await getBranchDSAccountIncome(date,staff)
    const SB = await getBranchSBAccountIncome(date,staff)
    const totalContribution = DS + SB
      
      return totalContribution;
  }
  async function getBranchAllExpenditure(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    const query = {
      createdAt: buildCumulativeCreatedAtQuery(date),
      branchId:branchId,
      status:1
    };
  
 
  
    // Count matching documents
    const expenditures = await Expenditure.find(query);
  
    const totalExpenditure = expenditures.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalExpenditure;
}
async function getBranchProfit(date = null,staff) {
    // const branch = await Staff.findOne({_id:staff})
    // const branchId = branch.branchId
    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
    };
  

  
    // Count matching documents
    const income = await getBranchAllSBandDSIncome(date,staff)
    const expenditure = await getBranchAllExpenditure(date,staff)
  
    const profit = income - expenditure
  
    return profit;
}
const getBranchSBIncomeReport = async (staff) => {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    try {
      const report = await SureBankAccount.find({ package: 'SB',branchId:branchId })
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
const getBranchDSIncomeReport = async (staff) => {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    try {
      const report = await SureBankAccount.find({ package: 'DS',branchId:branchId })
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
const getBranchExpenditureReport = async (staff) => {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    try {
      const report = await Expenditure.find({branchId:branchId,status:1})
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
  const getBranchOrder = async (staff) => {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    try {
      const [orders, sbAccounts, ecommerceOrders] = await Promise.all([
        Order.find({ branchId })
          .populate({
            path: 'accountManagerId',
            model: 'Staff',
          })
          .populate({
            path: 'branchId',
            model: 'Branch',
          })
          .populate({
            path: 'customerId',
            model: 'Customer',
          }),
        SBAccount.find({ branchId })
          .select('_id customerId branchId accountManagerId productName productDescription sellingPrice status createdAt SBAccountNumber createdBy')
          .populate({
            path: 'accountManagerId',
            model: 'Staff',
          })
          .populate({
            path: 'branchId',
            model: 'Branch',
          })
          .populate({
            path: 'customerId',
            model: 'Customer',
          }),
        EcommerceOrder.find({ branchId })
          .select('_id customerId branchId accountManagerId items totalAmount status paymentStatus createdAt SBAccountNumber')
          .populate({
            path: 'accountManagerId',
            model: 'Staff',
          })
          .populate({
            path: 'branchId',
            model: 'Branch',
          })
          .populate({
            path: 'customerId',
            model: 'Customer',
          }),
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

      const items = [...orders, ...filteredSbAccounts, ...normalizedEcommerceOrders]
        .map((item) => ({
          _id: item._id,
          customerId: item.customerId,
          branchId: item.branchId,
          accountManagerId: item.accountManagerId,
          productName: item.productName,
          sellingPrice: item.sellingPrice,
          status: normalizeOrderStatus(item),
          createdAt: item.createdAt,
        }))
        .sort((a, b) => {
          const statusPriority = { booked: 0, paid: 1 };
          const priorityA = statusPriority[a.status] ?? 99;
          const priorityB = statusPriority[b.status] ?? 99;

          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }

          return new Date(b.createdAt) - new Date(a.createdAt);
        });

      return { items };
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw new Error('Failed to retrieve transactions');
    }
  };

const getBranchEcommerceDeposit = async (date = null, staff) => {
  const branch = await Staff.findOne({ _id: staff }).select('branchId').lean();
  const branchId = branch?.branchId ? branch.branchId.toString() : null;
  const query = {
    package: 'Wallet',
    direction: 'Credit',
    narration: { $regex: ECOMMERCE_DEPOSIT_NARRATION_PATTERN }
  };

  const endDate = date ? new Date(date) : new Date();
  endDate.setHours(23, 59, 59, 999);
  query.createdAt = buildCumulativeCreatedAtQuery(date);

  if (branch?.branchId) {
    const branchStaff = await Staff.find({ branchId: branch.branchId }).select('_id').lean();
    const branchStaffIds = branchStaff.map((member) => member._id.toString());

    if (branchStaffIds.length === 0) {
      return 0;
    }

    query.createdBy = { $in: branchStaffIds };
  } else if (branchId) {
    query.branchId = branchId;
  }

  const transactions = await AccountTransaction.find(query).select('amount').lean();
  return transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
};

const getBranchEcommerceDepositReport = async (date = null, staff) => {
  const branch = await Staff.findOne({ _id: staff }).select('branchId').lean();
  const branchId = branch?.branchId ? branch.branchId.toString() : null;
  const query = {
    package: 'Wallet',
    direction: 'Credit',
    narration: { $regex: ECOMMERCE_DEPOSIT_NARRATION_PATTERN }
  };

  const endDate = date ? new Date(date) : new Date();
  endDate.setHours(23, 59, 59, 999);
  query.createdAt = buildCumulativeCreatedAtQuery(date);

  if (branch?.branchId) {
    const branchStaff = await Staff.find({ branchId: branch.branchId }).select('_id').lean();
    const branchStaffIds = branchStaff.map((member) => member._id.toString());

    if (branchStaffIds.length === 0) {
      return [];
    }

    query.createdBy = { $in: branchStaffIds };
  } else if (branchId) {
    query.branchId = branchId;
  }

  const transactions = await AccountTransaction.find(query)
    .sort({ createdAt: -1 })
    .lean();

  const customerIds = [...new Set(
    transactions
      .map((transaction) => transaction.customerId?.toString())
      .filter(isValidObjectId)
  )];
  const staffIds = [...new Set(
    transactions
      .map((transaction) => transaction.createdBy?.toString())
      .filter(isValidObjectId)
  )];

  const [customers, staffList] = await Promise.all([
    Customer.find({ _id: { $in: customerIds } }).select('_id firstName lastName phone').lean(),
    Staff.find({ _id: { $in: staffIds } }).select('_id firstName lastName').lean(),
  ]);

  const customerMap = new Map(customers.map((customer) => [customer._id.toString(), customer]));
  const staffMap = new Map(staffList.map((member) => [member._id.toString(), member]));

  return transactions.map((transaction) => ({
    _id: transaction._id,
    customerName: formatCustomerName(customerMap.get(transaction.customerId?.toString()) || null),
    narration: transaction.narration,
    amount: Number(transaction.amount || 0),
    date: transaction.createdAt,
    staffName: formatStaffName(staffMap.get(transaction.createdBy?.toString()) || null),
  }));
};
module.exports = {
    getAllBranchDSAccount,
    getAllBranchDSAccountWithdrawal,
    getAllBranchDSAccountCharge,
    getAllBranchSBAccount,
    getAllFDAccount,
    getAllFDInterestIncome,
    getAllFDInterestExpense,
    getAllFDTransaction,
    getAllFDPackage,
    getAllBranchSBAccountWithdrawal,
    getAllBranchDailyDSAccountChargeByDate,
    getAllBranchDailyDSAccountWithdrawalByDate,
    // getAllDailySBAccountWithdrawalByDate,
    getAllBranchSBandDSAccount,
    getAllBranchDailyDSAccount,
    getAllBranchDailyFDAccount,
    // getAllDailyDSAccountCharge,
    getAllBranchDailyDSAccountWithdrawal,
    getAllBranchDailySBAccount,
    getAllBranchDailySBAccountWithdrawal,
    getAllBranchDailySBandDSAccount,
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
    getBranchEcommerceDeposit,
    getBranchEcommerceDepositReport,
    getDailyReversalTotal,
  };
