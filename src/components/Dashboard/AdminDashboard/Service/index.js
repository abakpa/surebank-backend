const Account = require('../../../Account/Model/index');
const AccountTransaction = require('../../../AccountTransaction/Model/index');
const DSAccount = require('../../../DSAccount/Model');
const SBAccount = require('../../../SBAccount/Model');
const SureBankAccount = require('../../../SureBankAccount/Model');


async function getAllDSAccount() {
    const transactions = await AccountTransaction.find({ package: 'DS', direction: 'Credit' });
    
    // Sort transactions by createdAt in ascending order
    transactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Use a Map to store the latest balance for each accountTypeId
    const balanceMap = new Map();
    
    transactions.forEach(tx => {
        balanceMap.set(tx.accountTypeId, tx.balance);
    });
    
    // Calculate the sum of the latest balances
    const totalBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0);
    const dswithdrawal = await getAllDSAccountWithdrawal();
    const charge  = await getAllDSAccountCharge();
    const Withdrawal = dswithdrawal + charge
    
    return totalBalance - Withdrawal;
}
async function getAllDSAccountWithdrawal(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Debit' };

    if (date) {
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

    // Sum up all withdrawal amounts directly
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0) || 0;

    return totalBalance;
}


async function getAllDSAccountCharge() {
    const transactions = await AccountTransaction.find({ package: 'DS', direction: 'Charge' });
    
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

async function getAllSBAccount() {
    const transactions = await AccountTransaction.find({ package: 'SB', direction: 'Credit' });
    
    // Sort transactions by createdAt in ascending order
    transactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Use a Map to store the latest balance for each accountNumber
    const balanceMap = new Map();
    
    transactions.forEach(tx => {
        balanceMap.set(tx.accountTypeId, tx.balance);
    });
    
    // Calculate the sum of the latest balances
    const totalBalance = Array.from(balanceMap.values()).reduce((sum, balance) => sum + balance, 0);
    const SBWithdrawal = await getAllSBAccountWithdrawal()
    
    return totalBalance - SBWithdrawal;
}
async function getAllSBAccountWithdrawal() {
    const transactions = await AccountTransaction.find({ package: 'SB', direction: 'Debit' });
    
    // Sort transactions by createdAt in ascending order
    transactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    // Use a Map to store the latest balance for each accountNumber
    const balanceMap = new Map();
    
    transactions.forEach(tx => {
        balanceMap.set(tx.accountTypeId, tx.amount);
    });
    
    // Calculate the sum of the latest balances
    const totalBalance = Array.from(balanceMap.values()).reduce((sum, amount) => sum + amount, 0);
    
    return totalBalance;
}
async function getAllSBandDSAccount() {
    
  const DS = await getAllDSAccount()
  const SB = await getAllSBAccount()
  const totalContribution = DS + SB
    
    return totalContribution;
}
async function getAllDailyDSAccount(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Credit' };
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
    let dswithdrawal = 0, charge = 0;
    if(date && branchId){
     dswithdrawal = await getAllDailyDSAccountWithdrawalByDate(date,branchId) ;
     charge = await getAllDailyDSAccountChargeByDate(date,branchId);
    }else{
        dswithdrawal = await getAllDailyDSAccountWithdrawal()
        charge = await getAllDailyDSAccountCharge()
    }

    const Withdrawal = dswithdrawal + charge
    console.log("total",totalBalance-Withdrawal)
    
    return totalBalance - Withdrawal ;
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
async function getAllDailyDSAccountChargeByDate(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Charge' };
    
    if (!date) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        query.createdAt = { $lte: today };
    } else {
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt = { $lte: endDate };
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
async function getAllDailyDSAccountWithdrawalByDate(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Debit' };
    
    if (!date) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        query.createdAt = { $lte: today };
    } else {
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt = { $lte: endDate };
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


async function getAllDailySBAccount(date = null, branchId = null) {
    let query = { package: 'SB', direction: 'Credit' };
    
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
    let sbwithdrawal = 0
    if(date && branchId){
    sbwithdrawal = await getAllDailySBAccountWithdrawalByDate(date,branchId)
    }else{
    sbwithdrawal = await getAllDailySBAccountWithdrawal()
    }
    
    return totalBalance - sbwithdrawal;
}

async function getAllDailySBAccountWithdrawal(date = null, branchId = null) {
    let query = { package: 'SB', direction: 'Debit' };
    
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
async function getAllDailySBAccountWithdrawalByDate(date = null, branchId = null) {
    let query = { package: 'SB', direction: 'Debit' };
    
    if (!date) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        query.createdAt = { $lte: today };
    } else {
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt = { $lte: endDate };
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
async function getSBAccountIncome(date = null, branchId = null) {
    let query = { package: 'SB', direction: 'Credit' };
    
    if (!date) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: todayStart, $lte: todayEnd };
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
    
    const transactions = await SureBankAccount.find(query);
    
    // Calculate the sum of all amounts
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    return totalBalance;
}

async function getDSAccountIncome(date = null, branchId = null) {
    let query = { package: 'DS', direction: 'Credit' };
    
    if (!date) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: todayStart, $lte: todayEnd };
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
    
    const transactions = await SureBankAccount.find(query);
    
    // Calculate the sum of all amounts
    const totalBalance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    return totalBalance;
}
async function getAllSBandDSIncome(date = null, branchId = null) {

    const DS = await getDSAccountIncome(date,branchId)
    const SB = await getSBAccountIncome(date,branchId)
    const totalContribution = DS + SB
      
      return totalContribution;
  }

async function getAllDailySBandDSAccount(date = null, branchId = null) {

  const DS = await getAllDailyDSAccount(date,branchId)
  const SB = await getAllDailySBAccount(date,branchId)
  const totalContribution = DS + SB
    
    return totalContribution;
}

async function getAllDSAccountPackage() {
    const countPackage = await DSAccount.countDocuments({});
    
    return countPackage 
}
async function getAllSBAccountPackage() {
    const countPackage = await SBAccount.countDocuments({});
    
    return countPackage 
}
async function getAllAccountPackage() {
const sbPackage = await getAllSBAccountPackage()    
const dsPackage = await getAllDSAccountPackage()    
const packages = sbPackage + dsPackage
    return packages 
}

  module.exports = {
    getAllDSAccount,
    getAllDSAccountWithdrawal,
    getAllDSAccountCharge,
    getAllSBAccount,
    getAllSBAccountWithdrawal,
    getAllDailyDSAccountChargeByDate,
    getAllDailyDSAccountWithdrawalByDate,
    getAllDailySBAccountWithdrawalByDate,
    getAllSBandDSAccount,
    getAllDailyDSAccount,
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
    getAllSBandDSIncome
  };