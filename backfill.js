const mongoose = require("mongoose");
const AccountTransaction = require("./src/components/AccountTransaction/Model/index"); // adjust path
require('dotenv').config();

async function backfillTransactionOwnerId() {
  try {
         await mongoose.connect(process.env.MONGO_URI);

    // Update all documents where transactionOwnerId does not exist
    const result = await AccountTransaction.updateMany(
      { transactionOwnerId: { $exists: false } }, // only missing ones
      [{ $set: { transactionOwnerId: "$createdBy" } }] // pipeline update
    );

    console.log(`✅ Updated ${result.modifiedCount} documents`);
    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error backfilling transactionOwnerId:", error);
  }
}

backfillTransactionOwnerId();
