const Account = require('../../../Account/Model/index');
const AccountTransaction = require('../../../AccountTransaction/Model/index');
const DSAccount = require('../../../DSAccount/Model');
const SBAccount = require('../../../SBAccount/Model');
const SureBankAccount = require('../../../SureBankAccount/Model');
const Expenditure = require('../../../Expenditure/Model');
const Staff = require('../../../Staff/Model');
const FDAccount = require('../../../FDAccount/Model');


async function getAllRepDSAccount(date = null, staff) {
 
    let query = { package: 'DS', direction: 'Credit',createdBy:staff };
   
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
    const dswithdrawal = await getAllRepDSAccountWithdrawal(date,staff);
    const charge  = await getAllRepDSAccountCharge(date,staff);
    const Withdrawal = dswithdrawal + charge
    
    return totalBalance - Withdrawal;
}
async function getAllRepDSAccountWithdrawal(date = null, staff) {
   
    let query = { package: 'DS', direction: 'Debit',createdBy:staff };

     // Filter by date if provided or default to today
     const endDate = date ? new Date(date) : new Date();
     endDate.setHours(23, 59, 59, 999);
     query.createdAt = { $lte: endDate };


    const transactions = await AccountTransaction.find(query);

    // Sum up all withdrawal amounts directly
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return totalBalance;
}


async function getAllRepDSAccountCharge(date = null, staff) {
  
    let query = { package: 'DS', direction: 'Charge',createdBy:staff };
       // Filter by date if provided or default to today
       const endDate = date ? new Date(date) : new Date();
       endDate.setHours(23, 59, 59, 999);
       query.createdAt = { $lte: endDate };
     
    const transactions = await AccountTransaction.find(query);
    
   // Sum up all charge amounts directly
   const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;
    
    return totalBalance;
}

async function getAllRepSBAccount(date = null, staff) {

    let query = { package: 'SB', direction: 'Credit',createdBy:staff };
    
   
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
    const SBWithdrawal = await getAllRepSBAccountWithdrawal(date,staff)
    
    return totalBalance - SBWithdrawal;
}
async function getAllRepSBAccountWithdrawal(date = null, staff ) {
 
    let query = { package: 'SB', direction: 'Debit',createdBy:staff };

     // Filter by date if provided or default to today
     const endDate = date ? new Date(date) : new Date();
     endDate.setHours(23, 59, 59, 999);
     query.createdAt = { $lte: endDate };


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

    let query = { package: 'DS', direction: 'Credit',createdBy:staff };
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
    //  const dswithdrawal = await getAllRepDailyDSAccountWithdrawalByDate(date,staff) ;
    //  const charge = await getAllRepDailyDSAccountChargeByDate(date,staff);
 

    // const Withdrawal = dswithdrawal + charge
    
    return totalBalance  ;
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
   
   query.createdAt = { $gte: startDate, $lte: endDate };

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
  
    let query = { package: 'DS', direction: 'Charge',createdBy:staff };
    
   
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
async function getAllRepDailyDSAccountWithdrawalByDate(date = null, staff) {
 
    let query = { package: 'DS', direction: 'Debit',createdBy:staff };
  
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
  async function getAllRepDailySBAccount(date = null, staff) {
   
    let query = { package: 'SB', direction: 'Credit',createdBy:staff };
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
    //   const sbwithdrawal = await getAllDailySBAccountWithdrawalByDate(date,RepId) ;
     
     return totalBalance  ;
}

async function getAllRepDailySBAccountWithdrawal(date = null, staff) {

    let query = { package: 'SB', direction: 'Debit',createdBy:staff };
  
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
async function getAllRepDailyDSAccountWithdrawal(date = null, staff) {
  
    let query = { package: 'DS', direction: 'Debit',createdBy:staff };
  
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
async function getAllRepDailySBandDSAccount(date = null, staff) {

  const DS = await getAllRepDailyDSAccount(date,staff)
  const SB = await getAllRepDailySBAccount(date,staff)
  const totalContribution = DS + SB
    
    return totalContribution;
}
async function getAllRepDSAccountPackage(date = null, staff) {

    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
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

    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
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
const packages = sbPackage + dsPackage
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
  
    // Use today's date if none is provided
    const endDate = date ? new Date(date) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include the full day
  
    // Build query with date filter
    const query = {
      createdAt: { $lte: endDate },
      createdBy:staff
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
      const report = await Expenditure.find({createdBy:staff})
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
  
    const branch = await Staff.findOne({_id:staff})
    const branchId = branch.branchId
    try {
  
      // Fetch transactions and populate createdBy and customer details
      const transactions = await SBAccount.find({accountManagerId:staff})
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
  async function getAllFDPackage(date = null, staff) {
    // const branch = await Staff.findOne({_id:staff})
    // const branchId = branch.branchId
    try {
      // Use today's date if none is provided
      const endDate = date ? new Date(date) : new Date();
      endDate.setHours(23, 59, 59, 999); // Include the full day
    
      // Build query with date filter
      const query = {
        createdAt: { $lte: endDate },
        createdBy:staff
      };
    
      // Optionally filter by Rep
      // if (RepId) {
      //   query.RepId = RepId;
      // }
    
      // Count matching documents
      const countPackage = await FDAccount.countDocuments(query);
      return countPackage;
    } catch (error) {
      console.error("Error fetching FD accounts:", error);
      return { totalBalance: 0, count: 0 };
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
      query.createdAt = { $lte: endDate };
  
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
    getAllFDPackage,
    getAllFDAccount,
  };