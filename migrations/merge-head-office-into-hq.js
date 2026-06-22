const mongoose = require('mongoose');
require('dotenv').config();

const Account = require('../src/components/Account/Model');
const AccountTransaction = require('../src/components/AccountTransaction/Model');
const Branch = require('../src/components/Branch/Model');
const Customer = require('../src/components/Customer/Model');
const CustomerWithdrawalRequest = require('../src/components/CustomerWithdrawalRequest/Model');
const DSAccount = require('../src/components/DSAccount/Model');
const DSBalance = require('../src/components/DSAccount/Model/balance');
const EcommerceOrder = require('../src/components/EcommerceOrder/Model');
const Expenditure = require('../src/components/Expenditure/Model');
const FDAccount = require('../src/components/FDAccount/Model');
const FDStatement = require('../src/components/FDAccount/Model/fdStatement');
const Login = require('../src/components/Login/Model');
const Product = require('../src/components/Product/Model');
const SBAccount = require('../src/components/SBAccount/Model');
const LegacySBOrder = require('../src/components/SBAccount/Model/order');
const Staff = require('../src/components/Staff/Model');
const SureBankAccountTransaction = require('../src/components/SureBankAccount/Model');

const SOURCE_NAMES = [/^head\s*office$/i, /^head\s*office\s*branch$/i];
const TARGET_NAMES = [/^hq$/i];

const BRANCH_LINKED_MODELS = [
  ['Staff', Staff],
  ['Customer', Customer],
  ['Login', Login],
  ['Account', Account],
  ['AccountTransaction', AccountTransaction],
  ['DSAccount', DSAccount],
  ['DSBalance', DSBalance],
  ['SBAccount', SBAccount],
  ['LegacySBOrder', LegacySBOrder],
  ['SureBankAccountTransaction', SureBankAccountTransaction],
  ['FDAccount', FDAccount],
  ['FDStatement', FDStatement],
  ['EcommerceOrder', EcommerceOrder],
  ['Expenditure', Expenditure],
  ['CustomerWithdrawalRequest', CustomerWithdrawalRequest],
  ['Product', Product]
];

const findBranchByNames = async (patterns) => Branch.findOne({
  $or: patterns.map((pattern) => ({ name: pattern }))
});

const countLinkedRecords = async (branchId) => {
  const counts = {};
  for (const [name, model] of BRANCH_LINKED_MODELS) {
    counts[name] = await model.countDocuments({ branchId });
  }
  return counts;
};

const printCounts = (title, counts) => {
  console.log(`\n${title}`);
  Object.entries(counts).forEach(([name, count]) => {
    console.log(`${name}: ${count}`);
  });
};

const run = async () => {
  const shouldWrite = process.env.RUN_MERGE === 'true';

  await mongoose.connect(process.env.MONGO_URI);

  const hqBranch = await findBranchByNames(TARGET_NAMES);
  const headOfficeBranch = await findBranchByNames(SOURCE_NAMES);

  if (!hqBranch) {
    throw new Error('Cannot merge branches: active surviving branch "Hq" was not found.');
  }

  if (!headOfficeBranch) {
    console.log('No "Head Office" branch found. Nothing to merge.');
    await mongoose.disconnect();
    return;
  }

  if (hqBranch._id.toString() === headOfficeBranch._id.toString()) {
    console.log('"Hq" and "Head Office" resolve to the same branch record. Nothing to merge.');
    await mongoose.disconnect();
    return;
  }

  const hqBranchId = hqBranch._id.toString();
  const headOfficeBranchId = headOfficeBranch._id.toString();

  console.log(`Mode: ${shouldWrite ? 'WRITE' : 'DRY RUN'}`);
  console.log(`Surviving branch: ${hqBranch.name} (${hqBranchId})`);
  console.log(`Source branch: ${headOfficeBranch.name} (${headOfficeBranchId})`);

  const beforeHqCounts = await countLinkedRecords(hqBranchId);
  const beforeHeadOfficeCounts = await countLinkedRecords(headOfficeBranchId);
  printCounts('Before merge - Hq records', beforeHqCounts);
  printCounts('Before merge - Head Office records to move', beforeHeadOfficeCounts);

  if (!shouldWrite) {
    console.log('\nDry run complete. Re-run with RUN_MERGE=true to apply the merge.');
    await mongoose.disconnect();
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const [name, model] of BRANCH_LINKED_MODELS) {
      const result = await model.updateMany(
        { branchId: headOfficeBranchId },
        { $set: { branchId: hqBranchId } },
        { session }
      );
      console.log(`${name}: moved ${result.modifiedCount} records`);
    }

    hqBranch.branchKey = 'hq';
    hqBranch.branchType = 'head_office';
    hqBranch.isActive = true;
    await hqBranch.save({ session });

    headOfficeBranch.isActive = false;
    headOfficeBranch.mergedIntoBranchId = hqBranchId;
    headOfficeBranch.mergedAt = new Date();
    await headOfficeBranch.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  const afterHqCounts = await countLinkedRecords(hqBranchId);
  const afterHeadOfficeCounts = await countLinkedRecords(headOfficeBranchId);
  printCounts('After merge - Hq records', afterHqCounts);
  printCounts('After merge - Head Office records remaining', afterHeadOfficeCounts);

  const remaining = Object.values(afterHeadOfficeCounts).reduce((total, count) => total + count, 0);
  if (remaining > 0) {
    throw new Error(`Merge finished with ${remaining} records still pointing to Head Office.`);
  }

  console.log('\nBranch merge completed successfully.');
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Branch merge failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
