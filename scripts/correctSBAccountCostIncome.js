require('dotenv').config();

const mongoose = require('mongoose');

const SBAccount = require('../src/components/SBAccount/Model');
const SureBankAccountTransaction = require('../src/components/SureBankAccount/Model');

const money = (value) => Number(value || 0);

const CONFIG = {
  sbAccountNumber: process.env.SB_CORRECTION_ACCOUNT_NUMBER || 'SBA4324618',
  correctCostPrice: Number(process.env.SB_CORRECTION_COST_PRICE || 60000),
  reason: process.env.SB_CORRECTION_REASON || 'Cost price correction for clipper',
  actor: process.env.SB_CORRECTION_ACTOR || 'system-correction',
};

const formatDate = (date) => date.toLocaleString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const fail = (message) => {
  throw new Error(message);
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    fail('MONGO_URI is required in backend/.env');
  }

  if (!Number.isFinite(CONFIG.correctCostPrice) || CONFIG.correctCostPrice < 0) {
    fail('Correct cost price must be a non-negative number');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const account = await SBAccount.findOne({ SBAccountNumber: CONFIG.sbAccountNumber });
  if (!account) {
    fail(`SB account ${CONFIG.sbAccountNumber} was not found`);
  }

  const items = Array.isArray(account.items) ? account.items : [];
  if (items.length > 1) {
    fail(`Expected zero or one item on ${CONFIG.sbAccountNumber}, found ${items.length}`);
  }

  const item = items[0] || null;
  const quantity = item ? (money(item.quantity) || 1) : 1;
  const sellingSubtotal = item
    ? (money(item.subtotal) || money(item.price) * quantity || money(account.sellingPrice))
    : money(account.sellingPrice);
  const correctedCostSubtotal = CONFIG.correctCostPrice * quantity;
  const correctedProfit = sellingSubtotal - correctedCostSubtotal;

  if (correctedProfit < 0) {
    fail(`Corrected profit is still negative (${correctedProfit}). Check the cost price.`);
  }

  const existingCorrection = await SureBankAccountTransaction.findOne({
    package: 'SB',
    direction: 'Credit',
    type: account._id.toString(),
    narration: {
      $regex: `^Income correction for ${CONFIG.sbAccountNumber}`,
    },
  }).lean();

  if (existingCorrection) {
    fail(`A correction already exists for ${CONFIG.sbAccountNumber}: ${existingCorrection._id}`);
  }

  const incomeRows = await SureBankAccountTransaction.find({
    package: 'SB',
    direction: 'Credit',
    type: account._id.toString(),
  }).sort({ createdAt: 1 }).lean();

  const currentIncomeCredit = incomeRows.reduce((total, row) => total + money(row.amount), 0);
  const correctionAmount = correctedProfit - currentIncomeCredit;

  const before = {
    SBAccountNumber: account.SBAccountNumber,
    status: account.status,
    productName: item?.productName || account.productName,
    sellingSubtotal,
    oldItemCostPrice: item ? money(item.costPrice) : null,
    oldItemCostSubtotal: item ? money(item.costSubtotal) : null,
    oldItemProfitAmount: item ? money(item.profitAmount) : null,
    oldAccountCostPrice: money(account.costPrice),
    oldAccountProfit: money(account.profit),
    currentIncomeCredit,
    linkedIncomeRows: incomeRows.map((row) => ({
      id: row._id.toString(),
      narration: row.narration,
      amount: money(row.amount),
      createdAt: row.createdAt,
    })),
  };

  if (item) {
    item.costPrice = CONFIG.correctCostPrice;
    item.costSubtotal = correctedCostSubtotal;
    item.profitAmount = correctedProfit;
    item.profitReported = true;
    item.profitReportedAt = item.profitReportedAt || new Date();
  }

  account.costPrice = correctedCostSubtotal;
  account.profit = correctedProfit;

  const correction = await SureBankAccountTransaction.create({
    package: 'SB',
    date: formatDate(new Date()),
    direction: 'Credit',
    narration: `Income correction for ${CONFIG.sbAccountNumber}: ${CONFIG.reason}`,
    branchId: account.branchId,
    amount: correctionAmount,
    customerId: account.customerId,
    type: account._id.toString(),
  });

  await account.save();

  const afterIncomeCredit = currentIncomeCredit + correctionAmount;

  console.log('SB cost/income correction completed.');
  console.log(JSON.stringify({
    before,
    correction: {
      id: correction._id.toString(),
      amount: correctionAmount,
      narration: correction.narration,
    },
    after: {
      correctCostPrice: CONFIG.correctCostPrice,
      correctedCostSubtotal,
      correctedProfit,
      afterIncomeCredit,
    },
  }, null, 2));

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('SB cost/income correction failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('Mongo disconnect failed:', disconnectError.message);
  }
  process.exit(1);
});
