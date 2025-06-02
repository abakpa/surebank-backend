const Account = require('../../../Account/Model/index');
const AccountTransaction = require('../../../AccountTransaction/Model/index');
const DSAccount = require('../../../DSAccount/Model');
const SBAccount = require('../../../SBAccount/Model');
const SureBankAccount = require('../../../SureBankAccount/Model');
const Expenditure = require('../../../Expenditure/Model');
const Staff = require('../../../Staff/Model');
const FDAccount = require('../../../FDAccount/Model');



async function getAllBranchDSAccount(date = null, staff) {

    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'DS', direction: 'Credit',branchId:branchId };
    
   
    // Filter by date if provided or default to today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = { $lte: endDate };
  
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
    let query = { package: 'DS', direction: 'Debit',branchId:branchId };

     // Filter by date if provided or default to today
     const endDate = date ? new Date(date) : new Date();
     endDate.setHours(23, 59, 59, 999);
     query.createdAt = { $lte: endDate };


    const transactions = await AccountTransaction.find(query);

    // Sum up all withdrawal amounts directly
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return totalBalance;
}


async function getAllBranchDSAccountCharge(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'DS', direction: 'Charge',branchId };
       // Filter by date if provided or default to today
       const endDate = date ? new Date(date) : new Date();
       endDate.setHours(23, 59, 59, 999);
       query.createdAt = { $lte: endDate };
     
    const transactions = await AccountTransaction.find(query);
    
   // Sum up all charge amounts directly
   const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    
    return totalBalance;
}

async function getAllBranchSBAccount(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'SB', direction: 'Credit',branchId:branchId };
    
   
    // Filter by date if provided or default to today
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999);
    query.createdAt = { $lte: endDate };
  
  
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
    query.createdAt = { $lte: endDate };

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
async function getAllFDInterestExpense(date = null, staff) {
  const branch = await Staff.findOne({_id:staff})
  const branchId = branch.branchId
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
    query.createdAt = { $lte: endDate };

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
async function getAllBranchSBAccountWithdrawal(date = null, staff ) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'SB', direction: 'Debit',branchId:branchId };

     // Filter by date if provided or default to today
     const endDate = date ? new Date(date) : new Date();
     endDate.setHours(23, 59, 59, 999);
     query.createdAt = { $lte: endDate };


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
    let query = { package: 'DS', direction: 'Credit',branchId:branchId };
   // Filter by date if provided or default to today
   const targetDate = date ? new Date(date) : new Date();

   // Set start of day
   const startDate = new Date(targetDate);
   startDate.setHours(0, 0, 0, 0);
   
   // Set end of day
   const endDate = new Date(targetDate);
   endDate.setHours(23, 59, 59, 999);
   
   query.createdAt = { $gte: startDate, $lte: endDate };

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
   
   query.createdAt = { $gte: startDate, $lte: endDate };

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
    let query = { package: 'DS', direction: 'Charge',branchId:branchId };
    
   
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
    

  
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    return totalBalance;
}
async function getAllBranchDailyDSAccountWithdrawalByDate(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'DS', direction: 'Debit',branchId:branchId };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
    

  
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
  }
  async function getAllBranchDailySBAccount(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'SB', direction: 'Credit',branchId:branchId };
    // Filter by date if provided or default to today
    const targetDate = date ? new Date(date) : new Date();
 
    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
    
     
  
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
    let query = { package: 'SB', direction: 'Debit',branchId:branchId };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
    
  
 
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
}
async function getAllBranchDailyDSAccountWithdrawal(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    let query = { package: 'DS', direction: 'Debit',branchId:branchId };
  
    const targetDate = date ? new Date(date) : new Date();

    // Set start of day
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Set end of day
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
    
  
 
    // Get all matching debit transactions
    const transactions = await AccountTransaction.find(query);
  
    // Calculate the total amount of all debit transactions
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
    return totalBalance;
}
async function getAllBranchDailySBandDSAccount(date = null, staff) {

  const DS = await getAllBranchDailyDSAccount(date,staff)
  const SB = await getAllBranchDailySBAccount(date,staff)
  const totalContribution = DS + SB
    
    return totalContribution;
}
async function getAllBranchDSAccountPackage(date = null, staff) {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
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
    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
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
const packages = sbPackage + dsPackage
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
    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
      branchId:branchId
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
      const report = await Expenditure.find({branchId:branchId})
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
  const getBranchOrder = async (staff) => {
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    try {
  
      // Fetch transactions and populate createdBy and customer details
      const transactions = await SBAccount.find({branchId:branchId})
        .populate({
          path: 'accountManagerId', // Populate createdBy to get branch details
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
  };