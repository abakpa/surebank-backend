const Account = require('../../../Account/Model/index');
const AccountTransaction = require('../../../AccountTransaction/Model/index');
const DSAccount = require('../../../DSAccount/Model');
const SBAccount = require('../../../SBAccount/Model');
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
const FDAccount = require('../../../FDAccount/Model');
const Order = require('../../../SBAccount/Model/order');
const EcommerceOrder = require('../../../EcommerceOrder/Model');

const ECOMMERCE_DEPOSIT_NARRATION_PATTERN = /^(Wallet Funding|SB Order Wallet Funding|Order Payment to Wallet)/i;
const STAFF_SB_ORDER_WALLET_DEPOSIT_NARRATION_PATTERN = /^(Deposited by .* for Order|SB Order Wallet Deposit)/i;
const STAFF_STATS_QUERY_FILTER = { $ne: true };
const STAFF_TRANSACTION_EXCLUDED_NARRATION_QUERY = {
  $not: /^(Wallet Transfer to SB Account|To (SB|DS) account .* from wallet)/i
};

const buildStaffSBContributionQuery = (filters = {}) => ({
  ...filters,
  direction: 'Credit',
  excludeFromStaffStats: STAFF_STATS_QUERY_FILTER,
  $or: [
    {
      package: 'SB',
      narration: STAFF_TRANSACTION_EXCLUDED_NARRATION_QUERY
    },
    {
      package: 'Wallet',
      narration: { $regex: STAFF_SB_ORDER_WALLET_DEPOSIT_NARRATION_PATTERN }
    }
  ]
});

const buildStaffTransactionHistoryQuery = (createdBy) => ({
  createdBy,
  excludeFromStaffStats: STAFF_STATS_QUERY_FILTER,
  $or: [
    {
      package: { $in: ['SB', 'DS'] },
      direction: { $in: ['Debit', 'Credit'] },
      narration: STAFF_TRANSACTION_EXCLUDED_NARRATION_QUERY
    },
    {
      package: 'Wallet',
      direction: 'Credit',
      narration: { $regex: STAFF_SB_ORDER_WALLET_DEPOSIT_NARRATION_PATTERN }
    }
  ]
});

const formatStaffName = (staff) => {
  if (!staff) return 'N/A';
  return `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'N/A';
};

const formatCustomerName = (customer) => {
  if (!customer) return 'N/A';
  return `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.phone || 'N/A';
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


async function getAllRepDSAccount(date = null, staff) {
 
    let query = { package: 'DS', direction: 'Credit',createdBy:staff, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
   
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
    const dswithdrawal = await getAllRepDSAccountWithdrawal(date,staff);
    const charge  = await getAllRepDSAccountCharge(date,staff);
    const Withdrawal = dswithdrawal + charge
    
    return totalBalance - Withdrawal;
}
async function getAllRepDSAccountWithdrawal(date = null, staff) {
   
    let query = { package: 'DS', direction: 'Debit',createdBy:staff, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };

     // Filter by date if provided or default to today
     const endDate = date ? new Date(date) : new Date();
     endDate.setHours(23, 59, 59, 999);
     query.createdAt = buildCumulativeCreatedAtQuery(date);


    const transactions = await AccountTransaction.find(query);

    // Sum up all withdrawal amounts directly
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return totalBalance;
}


async function getAllRepDSAccountCharge(date = null, staff) {
  
    let query = { package: 'DS', direction: 'Charge',createdBy:staff, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
       // Filter by date if provided or default to today
       const endDate = date ? new Date(date) : new Date();
       endDate.setHours(23, 59, 59, 999);
       query.createdAt = buildCumulativeCreatedAtQuery(date);
     
    const transactions = await AccountTransaction.find(query);
    
   // Sum up all charge amounts directly
   const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    
    return totalBalance;
}

async function getAllRepSBAccount(date = null, staff) {

    let query = buildStaffSBContributionQuery({ createdBy: staff });
    
   
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
    const SBWithdrawal = await getAllRepSBAccountWithdrawal(date,staff)
    
    return totalBalance - SBWithdrawal;
}
async function getAllRepSBAccountWithdrawal(date = null, staff ) {
 
    let query = { package: 'SB', direction: 'Debit',createdBy:staff, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };

     // Filter by date if provided or default to today
     const endDate = date ? new Date(date) : new Date();
     endDate.setHours(23, 59, 59, 999);
     query.createdAt = buildCumulativeCreatedAtQuery(date);


    const transactions = await AccountTransaction.find(query);

    // Sum up all withdrawal amounts directly
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return totalBalance;
}
async function getAllRepSBandDSAccount(date = null, staff) {

  const DS = await getAllRepDSAccount(date,staff)
  const SB = await getAllRepSBAccount(date,staff)
  const totalContribution = DS + SB
    
    return totalContribution;
}
async function getAllRepDailyDSAccount(date = null, staff) {

    let query = { package: 'DS', direction: 'Credit',createdBy:staff, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
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

        const reversalTotal = await getDailyReversalTotal(date, staff);
         // Step 3: Subtract reversals
         const totalBalance1 = totalBalance - reversalTotal;
     
         return totalBalance1;
    // Calculate the sum of the latest balances
    // const totalBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0);
    //  const dswithdrawal = await getAllRepDailyDSAccountWithdrawalByDate(date,staff) ;
    //  const charge = await getAllRepDailyDSAccountChargeByDate(date,staff);
 

    // const Withdrawal = dswithdrawal + charge
    
    // return totalBalance  ;
}
async function getDailyReversalTotal(date = null, staff = null) {
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

    if (staff) {
        query.transactionOwnerId = staff;
    }
    // Only fetch reversal transactions
    // query.narration = { $regex: /^reversal$/i }; // case-insensitive match

    const reversalTransactions = await AccountTransaction.find(query);

    const reversalTotal = reversalTransactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    return reversalTotal;
}
async function getAllRepDailyFDAccount(date = null, staff) {

    let query = { package: 'FD', direction: 'Credit',createdBy:staff };
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
    //  const dswithdrawal = await getAllRepDailyDSAccountWithdrawalByDate(date,staff) ;
    //  const charge = await getAllRepDailyDSAccountChargeByDate(date,staff);
 

    // const Withdrawal = dswithdrawal + charge
    
    return totalBalance  ;
}
async function getAllRepDailyDSAccountChargeByDate(date = null, staff) {
  
    let query = { package: 'DS', direction: 'Charge',createdBy:staff, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
    
   
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
async function getAllRepDailyDSAccountWithdrawalByDate(date = null, staff) {
 
    let query = { package: 'DS', direction: 'Debit',createdBy:staff, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
  
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
  async function getAllRepDailySBAccount(date = null, staff) {
   
    let query = buildStaffSBContributionQuery({ createdBy: staff });
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
    //   const sbwithdrawal = await getAllDailySBAccountWithdrawalByDate(date,RepId) ;
     
     return totalBalance  ;
}

async function getAllRepDailySBAccountWithdrawal(date = null, staff) {

    let query = { package: 'SB', direction: 'Debit',createdBy:staff, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
  
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
async function getAllRepDailyDSAccountWithdrawal(date = null, staff) {
  
    let query = { package: 'DS', direction: 'Debit',createdBy:staff, excludeFromStaffStats: STAFF_STATS_QUERY_FILTER };
  
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
async function getAllRepFreeToWithdrawWithdrawal(date = null, staff) {
    const query = {
      package: 'Account',
      direction: 'Debit',
      narration: 'Withdrawal',
      createdBy: staff,
      excludeFromStaffStats: STAFF_STATS_QUERY_FILTER,
      createdAt: buildDailyCreatedAtQuery(date)
    };

    const transactions = await AccountTransaction.find(query);
    return transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
}
async function getRepFreeToWithdrawWithdrawalReport(date = null, staff) {
    const query = {
      package: 'Account',
      direction: 'Debit',
      narration: 'Withdrawal',
      createdBy: staff,
      excludeFromStaffStats: STAFF_STATS_QUERY_FILTER,
      createdAt: buildDailyCreatedAtQuery(date)
    };

    const transactions = await AccountTransaction.find(query)
      .populate({
        path: 'customerId',
        model: 'Customer',
        select: 'firstName lastName phone'
      })
      .populate({
        path: 'createdBy',
        model: 'Staff',
        select: 'firstName lastName'
      })
      .sort({ createdAt: -1 })
      .lean();

    return transactions.map((transaction) => ({
      _id: transaction._id,
      customerName: formatCustomerName(transaction.customerId),
      narration: transaction.narration,
      amount: Number(transaction.amount || 0),
      date: transaction.createdAt,
      staffName: formatStaffName(transaction.createdBy),
    }));
}
async function getAllRepDailySBandDSAccount(date = null, staff) {

  const DS = await getAllRepDailyDSAccount(date,staff)
  const SB = await getAllRepDailySBAccount(date,staff)
  const FD = await getAllRepDailyFDAccount(date,staff)
  const totalContribution = DS + SB + FD
    
    return totalContribution;
}
async function getAllRepDSAccountPackage(date = null, staff) {
    const query = {
      createdAt: buildCumulativeCreatedAtQuery(date),
      accountManagerId:staff
    };
  
    // Optionally filter by Rep
    // if (RepId) {
    //   query.RepId = RepId;
    // }
  
    // Count matching documents
    const countPackage = await DSAccount.countDocuments(query);
    return countPackage;
  }
  
  
async function getAllRepSBAccountPackage(date = null, staff) {
    const query = {
      createdAt: buildCumulativeCreatedAtQuery(date),
      accountManagerId:staff
    };
  
    // Optionally filter by Rep
    // if (RepId) {
    //   query.RepId = RepId;
    // }
  
    // Count matching documents
    const countPackage = await SBAccount.countDocuments(query);
    return countPackage;
}
async function getAllRepAccountPackage(date = null, staff) {
const sbPackage = await getAllRepSBAccountPackage(date,staff)    
const dsPackage = await getAllRepDSAccountPackage(date,staff)    
const fdPackage = await getAllFDPackage(date,staff)    
const packages = sbPackage + dsPackage + fdPackage
    return packages 
}
async function getRepSBAccountIncome(date = null, staff) {
  
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
  
    const query = {
      package: 'SB',
      direction: 'Credit',
      createdAt: { $lte: endDate },
      createdBy:staff
    };
  
    // if (RepId) {
    //   query.RepId = RepId;
    // }
  
    const transactions = await SureBankAccount.find(query);
  
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
  }
  

async function getRepDSAccountIncome(date = null, staff) {
  
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
  
    const query = {
      package: 'DS',
      direction: 'Credit',
      createdAt: { $lte: endDate },
      createdBy:staff
    };
  
    // if (RepId) {
    //   query.RepId = RepId;
    // }
  
    const transactions = await SureBankAccount.find(query);
  
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
  }
  
async function getRepAllSBandDSIncome(date = null, staff) {

    const DS = await getRepDSAccountIncome(date,staff)
    const SB = await getRepSBAccountIncome(date,staff)
    const totalContribution = DS + SB
      
      return totalContribution;
  }
  async function getRepAllExpenditure(date = null, staff) {
    const query = {
      createdAt: buildCumulativeCreatedAtQuery(date),
      createdBy:staff,
      status:1
    };
  
 
  
    // Count matching documents
    const expenditures = await Expenditure.find(query);
  
    const totalExpenditure = expenditures.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalExpenditure;
}
async function getRepProfit(date = null,staff) {
    // const Rep = await Staff.findOne({_id:staff})
    // const RepId = Rep.RepId
    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
    };
  

  
    // Count matching documents
    const income = await getRepAllSBandDSIncome(date,staff)
    const expenditure = await getRepAllExpenditure(date,staff)
  
    const profit = income - expenditure
  
    return profit;
}
const getRepSBIncomeReport = async (staff) => {
  
    try {
      const report = await SureBankAccount.find({ package: 'SB',createdBy:staff })
        .populate({
          path: 'customerId',
          populate: {
            path: 'RepId', 
            model: 'Rep'
          }
        });
  
      return report;
    } catch (error) {
      console.error('Error fetching SB income report:', error);
      throw new Error('Failed to retrieve SB income report');
    }
  };
const getRepDSIncomeReport = async (staff) => {
  
    try {
      const report = await SureBankAccount.find({ package: 'DS',createdBy:staff })
        .populate({
          path: 'customerId',
          populate: {
            path: 'RepId', 
            model: 'Rep'
          }
        });
  
      return report;
    } catch (error) {
      console.error('Error fetching DS income report:', error);
      throw new Error('Failed to retrieve SB income report');
    }
  };
const getRepExpenditureReport = async (staff) => {
  
    try {
      const report = await Expenditure.find({createdBy:staff,status:1})
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
      const transactions = await AccountTransaction.find(buildStaffTransactionHistoryQuery(createdBy))
        .populate({
          path: 'createdBy', // Populate createdBy to get Rep details
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
  const getRepOrder = async (staff) => {
  
    // const branch = await Staff.findOne({_id:staff})
    // const branchId = branch.branchId
    try {
      const [orders, sbAccounts, ecommerceOrders] = await Promise.all([
        Order.find({ accountManagerId: staff })
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
        SBAccount.find({ accountManagerId: staff })
          .select('_id customerId branchId accountManagerId productName productDescription sellingPrice status createdAt SBAccountNumber createdBy items')
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
        EcommerceOrder.find({ accountManagerId: staff })
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

      const normalizedEcommerceOrders = ecommerceOrders.flatMap((order) => {
        const fallbackAccount = order.SBAccountNumber
          ? sbAccountMap.get(order.SBAccountNumber)
          : null;
        const orderItems = Array.isArray(order.items) && order.items.length > 0
          ? order.items
          : [{
              _id: '',
              productName: getEcommerceProductName(order, fallbackAccount),
              subtotal: getEcommerceSellingPrice(order, fallbackAccount),
              fulfillmentStatus: order.status
            }];

        return orderItems.map((item, index) => ({
          _id: `${order._id}-${item._id || index}`,
          orderId: order._id,
          itemId: item._id || '',
          customerId: order.customerId,
          branchId: order.branchId,
          accountManagerId: order.accountManagerId,
          productName: item.productName || item.name || getEcommerceProductName(order, fallbackAccount),
          sellingPrice: Number(item.subtotal || 0) || getEcommerceSellingPrice(order, fallbackAccount),
          status: normalizeOrderStatus(order),
          itemFulfillmentStatus: item.fulfillmentStatus || 'pending',
          createdAt: order.createdAt,
        }));
      });

      const filteredSbAccounts = sbAccounts.filter((account) => {
        const isEcommerceDefaultAccount =
          account.createdBy === 'ECOMMERCE_SYSTEM' &&
          account.productDescription === 'Default SB Account for e-commerce customers';

        return !ecommerceSbAccountNumbers.has(account.SBAccountNumber) && !isEcommerceDefaultAccount;
      });

      const expandAccountItems = (accounts) => accounts.flatMap((account) => {
        const accountItems = Array.isArray(account.items) && account.items.length > 0
          ? account.items
          : [{
              _id: '',
              productName: account.productName,
              subtotal: account.sellingPrice,
              fulfillmentStatus: account.status
            }];

        return accountItems.map((item, index) => ({
          _id: `${account._id}-${item._id || item.productId || index}`,
          customerId: account.customerId,
          branchId: account.branchId,
          accountManagerId: account.accountManagerId,
          productName: item.productName || account.productName,
          sellingPrice: Number(item.subtotal || 0) || Number(account.sellingPrice || 0),
          status: normalizeOrderStatus(account),
          itemFulfillmentStatus: item.fulfillmentStatus || '',
          createdAt: account.createdAt,
        }));
      });

      const items = [...expandAccountItems(orders), ...expandAccountItems(filteredSbAccounts), ...normalizedEcommerceOrders]
        .map((item) => ({
          _id: item._id,
          customerId: item.customerId,
          branchId: item.branchId,
          accountManagerId: item.accountManagerId,
          productName: item.productName,
          sellingPrice: item.sellingPrice,
          status: normalizeOrderStatus(item),
          itemFulfillmentStatus: item.itemFulfillmentStatus || '',
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
  const getRepEcommerceDeposit = async (date = null, staff) => {
    const query = {
      package: 'Wallet',
      direction: 'Credit',
      createdBy: staff,
      narration: { $regex: ECOMMERCE_DEPOSIT_NARRATION_PATTERN }
    };

    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = buildCumulativeCreatedAtQuery(date);

    const transactions = await AccountTransaction.find(query).select('amount').lean();
    return transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  };
  const getRepEcommerceDepositReport = async (date = null, staff) => {
    const query = {
      package: 'Wallet',
      direction: 'Credit',
      createdBy: staff,
      narration: { $regex: ECOMMERCE_DEPOSIT_NARRATION_PATTERN }
    };

    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = buildCumulativeCreatedAtQuery(date);

    const transactions = await AccountTransaction.find(query)
      .populate({
        path: 'customerId',
        model: 'Customer',
        select: 'firstName lastName phone'
      })
      .sort({ createdAt: -1 })
      .lean();

    return transactions.map((transaction) => ({
      _id: transaction._id,
      customerName: formatCustomerName(transaction.customerId),
      narration: transaction.narration,
      amount: Number(transaction.amount || 0),
      date: transaction.createdAt,
    }));
  };
  async function getAllFDPackage(date = null, staff) {
    try {
      const query = {
        accountManagerId: staff,
        createdAt: buildCumulativeCreatedAtQuery(date),
      };

      return await FDAccount.countDocuments(query);
    } catch (error) {
      console.error("Error fetching FD accounts:", error);
      return 0;
    }
  }
  async function getAllFDAccount(date = null, staff) {
    // const branch = await Staff.findOne({_id:staff})
    // const branchId = branch.branchId
    try {
      const query = {createdBy:staff};
  
      // Set end of the provided date or today
      const endDate = date ? new Date(date) : new Date();
      endDate.setHours(23, 59, 59, 999);
      query.createdAt = buildCumulativeCreatedAtQuery(date);
  
      // Filter by branch if branchId is provided
      // if (branchId) {
      //   query.branchId = branchId;
      // }
  
      const transactions = await FDAccount.find(query);
  
      const totalBalance = transactions.reduce((sum, tx) => sum + (tx.fdamount || 0), 0);
  
      return totalBalance
    } catch (error) {
      console.error("Error fetching FD accounts:", error);
      return totalBalance = 0
    }
  }
module.exports = {
    getAllRepDSAccount,
    getAllRepDSAccountWithdrawal,
    getAllRepDSAccountCharge,
    getAllRepSBAccount,
    getAllRepSBAccountWithdrawal,
    getAllRepDailyDSAccountChargeByDate,
    getAllRepDailyDSAccountWithdrawalByDate,
    // getAllDailySBAccountWithdrawalByDate,
    getAllRepSBandDSAccount,
    getAllRepDailyDSAccount,
    getAllRepDailyFDAccount,
    // getAllDailyDSAccountCharge,
    getAllRepDailyDSAccountWithdrawal,
    getAllRepFreeToWithdrawWithdrawal,
    getRepFreeToWithdrawWithdrawalReport,
    getAllRepDailySBAccount,
    getAllRepDailySBAccountWithdrawal,
    getAllRepDailySBandDSAccount,
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
    getAllFDPackage,
    getAllFDAccount,
    getDailyReversalTotal
  };
