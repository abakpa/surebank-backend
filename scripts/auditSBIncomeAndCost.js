require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const SBAccount = require('../src/components/SBAccount/Model');
const SBOrder = require('../src/components/SBAccount/Model/order');
const SureBankAccountTransaction = require('../src/components/SureBankAccount/Model');
const Customer = require('../src/components/Customer/Model');
const Branch = require('../src/components/Branch/Model');

const money = (value) => Number(value || 0);

const redactMongoUri = (uri = '') => {
  if (!uri) return '';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//<user>:<password>@');
};

const sum = (rows, selector) => rows.reduce((total, row) => total + money(selector(row)), 0);

const buildName = (doc) => {
  if (!doc) return '';
  return [doc.firstName, doc.lastName].filter(Boolean).join(' ') || doc.name || '';
};

const normalizeItems = (account) => {
  if (Array.isArray(account.items) && account.items.length > 0) {
    return account.items.map((item) => ({
      productId: item.productId || '',
      variationId: item.variationId || '',
      productName: item.productName || '',
      quantity: money(item.quantity),
      price: money(item.price),
      subtotal: money(item.subtotal),
      costPrice: money(item.costPrice),
      costSubtotal: money(item.costSubtotal),
      profitAmount: money(item.profitAmount),
      profitReported: item.profitReported === true,
      profitReportedAt: item.profitReportedAt || null,
      fulfillmentStatus: item.fulfillmentStatus || '',
    }));
  }

  return [{
    productId: '',
    variationId: '',
    productName: account.productName || '',
    quantity: 1,
    price: money(account.sellingPrice),
    subtotal: money(account.sellingPrice),
    costPrice: money(account.costPrice),
    costSubtotal: money(account.costPrice),
    profitAmount: money(account.profit),
    profitReported: false,
    profitReportedAt: null,
    fulfillmentStatus: account.status || '',
  }];
};

const summarizeAccount = ({ account, source, customerMap, branchMap, incomeRows }) => {
  const items = normalizeItems(account);
  const itemSubtotal = sum(items, (item) => item.subtotal);
  const itemCostSubtotal = sum(items, (item) => item.costSubtotal);
  const itemProfit = sum(items, (item) => item.profitAmount);
  const fallbackProfit = money(account.profit);
  const expectedProfit = itemProfit || fallbackProfit;
  const linkedIncome = incomeRows.filter((row) => {
    const type = row.type ? String(row.type) : '';
    const narration = row.narration || '';
    return (
      type === String(account._id) ||
      narration.includes(account.SBAccountNumber || '') ||
      narration.includes(account.productName || '__NO_PRODUCT__')
    );
  });
  const incomeCredit = sum(linkedIncome.filter((row) => row.direction === 'Credit'), (row) => row.amount);
  const incomeDebit = sum(linkedIncome.filter((row) => row.direction === 'Debit'), (row) => row.amount);
  const negativeIncome = linkedIncome.filter((row) => money(row.amount) < 0);
  const customer = customerMap.get(String(account.customerId));
  const branch = branchMap.get(String(account.branchId));

  return {
    source,
    id: String(account._id),
    SBAccountNumber: account.SBAccountNumber,
    accountNumber: account.accountNumber,
    status: account.status,
    customerName: buildName(customer),
    customerPhone: customer?.phone || '',
    branchName: branch?.name || '',
    sellingPrice: money(account.sellingPrice),
    accountCostPrice: money(account.costPrice),
    accountProfit: fallbackProfit,
    balance: money(account.balance),
    itemSubtotal,
    itemCostSubtotal,
    itemProfit,
    expectedProfit,
    incomeCredit,
    incomeDebit,
    linkedIncomeNet: incomeCredit - incomeDebit,
    incomeDifference: incomeCredit - expectedProfit,
    negativeIncomeCount: negativeIncome.length,
    items,
    linkedIncome: linkedIncome.map((row) => ({
      id: String(row._id),
      date: row.date,
      direction: row.direction,
      narration: row.narration,
      amount: money(row.amount),
      createdAt: row.createdAt,
    })),
  };
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required in backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const [sbAccounts, sbOrders, incomeRows, customers, branches] = await Promise.all([
    SBAccount.find({}).lean(),
    SBOrder.find({}).lean(),
    SureBankAccountTransaction.find({ package: 'SB' }).sort({ createdAt: 1 }).lean(),
    Customer.find({}).select('firstName lastName name phone').lean(),
    Branch.find({}).select('name').lean(),
  ]);

  const customerMap = new Map(customers.map((customer) => [String(customer._id), customer]));
  const branchMap = new Map(branches.map((branch) => [String(branch._id), branch]));
  const accountSummaries = [
    ...sbAccounts.map((account) => summarizeAccount({
      account,
      source: 'SBAccount',
      customerMap,
      branchMap,
      incomeRows,
    })),
    ...sbOrders.map((account) => summarizeAccount({
      account,
      source: 'SBOrder',
      customerMap,
      branchMap,
      incomeRows,
    })),
  ];

  const creditIncomeRows = incomeRows.filter((row) => row.direction === 'Credit');
  const debitIncomeRows = incomeRows.filter((row) => row.direction === 'Debit');
  const negativeIncomeRows = incomeRows.filter((row) => money(row.amount) < 0);
  const suspiciousAccounts = accountSummaries.filter((account) => (
    account.negativeIncomeCount > 0 ||
    account.expectedProfit < 0 ||
    account.incomeCredit < 0 ||
    Math.abs(account.incomeDifference) > 0.009
  ));

  const report = {
    generatedAt: new Date().toISOString(),
    database: redactMongoUri(process.env.MONGO_URI),
    totals: {
      sbAccountCount: sbAccounts.length,
      sbOrderCount: sbOrders.length,
      incomeTransactionCount: incomeRows.length,
      creditIncomeTransactionCount: creditIncomeRows.length,
      debitIncomeTransactionCount: debitIncomeRows.length,
      negativeIncomeTransactionCount: negativeIncomeRows.length,
      totalSellingPrice: sum(accountSummaries, (account) => account.sellingPrice),
      totalAccountCostPrice: sum(accountSummaries, (account) => account.accountCostPrice),
      totalAccountProfit: sum(accountSummaries, (account) => account.accountProfit),
      totalItemSubtotal: sum(accountSummaries, (account) => account.itemSubtotal),
      totalItemCostSubtotal: sum(accountSummaries, (account) => account.itemCostSubtotal),
      totalItemProfit: sum(accountSummaries, (account) => account.itemProfit),
      totalExpectedProfit: sum(accountSummaries, (account) => account.expectedProfit),
      totalSBIncomeCredit: sum(creditIncomeRows, (row) => row.amount),
      totalSBIncomeDebit: sum(debitIncomeRows, (row) => row.amount),
      totalSBIncomeNet: sum(creditIncomeRows, (row) => row.amount) - sum(debitIncomeRows, (row) => row.amount),
      totalNegativeSBIncome: sum(negativeIncomeRows, (row) => row.amount),
      suspiciousAccountCount: suspiciousAccounts.length,
    },
    negativeIncomeRows: negativeIncomeRows.map((row) => ({
      id: String(row._id),
      date: row.date,
      direction: row.direction,
      narration: row.narration,
      amount: money(row.amount),
      customerId: row.customerId,
      branchId: row.branchId,
      type: row.type,
      createdAt: row.createdAt,
    })),
    suspiciousAccounts,
    accounts: accountSummaries,
  };

  const reportPath = path.join(__dirname, `sb-income-cost-audit-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('SB income/cost audit completed.');
  console.log(`Database: ${report.database}`);
  console.log(`Report file: ${reportPath}`);
  console.table(report.totals);

  if (negativeIncomeRows.length > 0) {
    console.log('\nNegative SB income transactions:');
    console.table(report.negativeIncomeRows.slice(0, 25));
    if (negativeIncomeRows.length > 25) {
      console.log(`Showing first 25 of ${negativeIncomeRows.length}. Full list is in the report file.`);
    }
  }

  if (suspiciousAccounts.length > 0) {
    console.log('\nSuspicious SB accounts:');
    console.table(suspiciousAccounts.slice(0, 25).map((account) => ({
      source: account.source,
      SBAccountNumber: account.SBAccountNumber,
      customerName: account.customerName,
      status: account.status,
      expectedProfit: account.expectedProfit,
      incomeCredit: account.incomeCredit,
      incomeDifference: account.incomeDifference,
      negativeIncomeCount: account.negativeIncomeCount,
    })));
    if (suspiciousAccounts.length > 25) {
      console.log(`Showing first 25 of ${suspiciousAccounts.length}. Full list is in the report file.`);
    }
  }

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('SB income/cost audit failed:', error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('Mongo disconnect failed:', disconnectError.message);
  }
  process.exit(1);
});
