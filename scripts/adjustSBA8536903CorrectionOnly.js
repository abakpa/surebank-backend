require('dotenv').config();

const mongoose = require('mongoose');

const SBAccount = require('../src/components/SBAccount/Model');
const SureBankAccountTransaction = require('../src/components/SureBankAccount/Model');

const CONFIG = {
  sbAccountNumber: 'SBA8536903',
  badTransactionId: '6a366ade6f8fd6982704b48d',
  previousCorrectionId: '6a3c019685abc4d058bd515e',
  badAmount: -50000,
  correctIncomeForBadRecord: 15000,
};

const money = (value) => Number(value || 0);

const fail = (message) => {
  throw new Error(message);
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    fail('MONGO_URI is required in backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const account = await SBAccount.findOne({ SBAccountNumber: CONFIG.sbAccountNumber });
  if (!account) {
    fail(`SB account ${CONFIG.sbAccountNumber} was not found`);
  }

  const badTransaction = await SureBankAccountTransaction.findById(CONFIG.badTransactionId);
  if (!badTransaction) {
    fail(`Bad transaction ${CONFIG.badTransactionId} was not found`);
  }

  if (String(badTransaction.type || '') !== String(account._id)) {
    fail('Bad transaction does not belong to the expected SB account');
  }

  if (money(badTransaction.amount) !== CONFIG.badAmount) {
    fail(`Bad transaction amount is ${badTransaction.amount}, expected ${CONFIG.badAmount}`);
  }

  const correction = await SureBankAccountTransaction.findById(CONFIG.previousCorrectionId);
  if (!correction) {
    fail(`Previous correction ${CONFIG.previousCorrectionId} was not found`);
  }

  if (String(correction.type || '') !== String(account._id)) {
    fail('Previous correction does not belong to the expected SB account');
  }

  const correctedAmount = CONFIG.correctIncomeForBadRecord - CONFIG.badAmount;
  const before = {
    SBAccountNumber: account.SBAccountNumber,
    badTransaction: {
      id: badTransaction._id.toString(),
      narration: badTransaction.narration,
      amount: money(badTransaction.amount),
    },
    previousCorrection: {
      id: correction._id.toString(),
      narration: correction.narration,
      amount: money(correction.amount),
    },
  };

  correction.amount = correctedAmount;
  correction.narration = `Income correction for ${CONFIG.sbAccountNumber}: correct only transaction ${CONFIG.badTransactionId}`;
  await correction.save();

  const after = {
    correctedAmount,
    badRecordNetIncome: money(badTransaction.amount) + correctedAmount,
    correction: {
      id: correction._id.toString(),
      narration: correction.narration,
      amount: money(correction.amount),
    },
  };

  console.log('SBA8536903 correction adjusted to target only the bad transaction.');
  console.log(JSON.stringify({ before, after }, null, 2));

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('SBA8536903 correction adjustment failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('Mongo disconnect failed:', disconnectError.message);
  }
  process.exit(1);
});
