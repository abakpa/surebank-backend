require('dotenv').config();

const mongoose = require('mongoose');

const SBAccount = require('../src/components/SBAccount/Model');
const SureBankAccountTransaction = require('../src/components/SureBankAccount/Model');

const CORRECTIONS = [
  {
    sbAccountNumber: 'SBA7842379',
    correctIncome: 130000,
    reason: 'Correct income for Hisence 2 tons inverter standing AC',
  },
  {
    sbAccountNumber: 'SBA8536903',
    correctIncome: 15000,
    reason: 'Correct income for Cliper',
  },
];

const money = (value) => Number(value || 0);

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

const getSellingSubtotal = (account, item) => {
  if (item) {
    const quantity = money(item.quantity) || 1;
    return money(item.subtotal) || money(item.price) * quantity || money(account.sellingPrice);
  }

  return money(account.sellingPrice);
};

const applyCorrection = async ({ sbAccountNumber, correctIncome, reason }) => {
  if (!Number.isFinite(correctIncome) || correctIncome < 0) {
    fail(`Invalid correct income for ${sbAccountNumber}`);
  }

  const account = await SBAccount.findOne({ SBAccountNumber: sbAccountNumber });
  if (!account) {
    fail(`SB account ${sbAccountNumber} was not found`);
  }

  const items = Array.isArray(account.items) ? account.items : [];
  if (items.length > 1) {
    fail(`Expected zero or one item on ${sbAccountNumber}, found ${items.length}`);
  }

  const existingCorrection = await SureBankAccountTransaction.findOne({
    package: 'SB',
    direction: 'Credit',
    type: account._id.toString(),
    narration: { $regex: `^Income correction for ${sbAccountNumber}` },
  }).lean();

  if (existingCorrection) {
    fail(`A correction already exists for ${sbAccountNumber}: ${existingCorrection._id}`);
  }

  const incomeRows = await SureBankAccountTransaction.find({
    package: 'SB',
    direction: 'Credit',
    type: account._id.toString(),
  }).sort({ createdAt: 1 }).lean();

  const currentIncomeCredit = incomeRows.reduce((total, row) => total + money(row.amount), 0);
  const correctionAmount = correctIncome - currentIncomeCredit;
  const item = items[0] || null;
  const sellingSubtotal = getSellingSubtotal(account, item);
  const quantity = item ? (money(item.quantity) || 1) : 1;
  const correctedCostSubtotal = sellingSubtotal - correctIncome;
  const correctedCostPrice = quantity > 0 ? correctedCostSubtotal / quantity : correctedCostSubtotal;

  if (correctedCostSubtotal < 0) {
    fail(`Correct income is greater than selling subtotal for ${sbAccountNumber}`);
  }

  const before = {
    SBAccountNumber: account.SBAccountNumber,
    status: account.status,
    productName: item?.productName || account.productName,
    sellingSubtotal,
    oldAccountCostPrice: money(account.costPrice),
    oldAccountProfit: money(account.profit),
    oldItemCostPrice: item ? money(item.costPrice) : null,
    oldItemCostSubtotal: item ? money(item.costSubtotal) : null,
    oldItemProfitAmount: item ? money(item.profitAmount) : null,
    currentIncomeCredit,
    linkedIncomeRows: incomeRows.map((row) => ({
      id: row._id.toString(),
      narration: row.narration,
      amount: money(row.amount),
      createdAt: row.createdAt,
    })),
  };

  if (item) {
    item.costPrice = correctedCostPrice;
    item.costSubtotal = correctedCostSubtotal;
    item.profitAmount = correctIncome;
    item.profitReported = true;
    item.profitReportedAt = item.profitReportedAt || new Date();
  }

  account.costPrice = correctedCostSubtotal;
  account.profit = correctIncome;

  const correction = await SureBankAccountTransaction.create({
    package: 'SB',
    date: formatDate(new Date()),
    direction: 'Credit',
    narration: `Income correction for ${sbAccountNumber}: ${reason}`,
    branchId: account.branchId,
    amount: correctionAmount,
    customerId: account.customerId,
    type: account._id.toString(),
  });

  await account.save();

  return {
    before,
    correction: {
      id: correction._id.toString(),
      amount: correctionAmount,
      narration: correction.narration,
    },
    after: {
      correctedCostPrice,
      correctedCostSubtotal,
      correctIncome,
      afterIncomeCredit: currentIncomeCredit + correctionAmount,
    },
  };
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    fail('MONGO_URI is required in backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const results = [];
  for (const correction of CORRECTIONS) {
    results.push(await applyCorrection(correction));
  }

  console.log('Specific SB income corrections completed.');
  console.log(JSON.stringify(results, null, 2));

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('Specific SB income correction failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('Mongo disconnect failed:', disconnectError.message);
  }
  process.exit(1);
});
