const Expenditure = require('../src/components/Expenditure/Model/index'); // adjust path as needed
const mongoose = require('mongoose');
require('dotenv').config();

async function addStatusToExisting() {
  try {
     await mongoose.connect(process.env.MONGO_URI);
    const result = await Expenditure.updateMany(
      { status: { $exists: false } }, // only update if status is missing
      { $set: { status: 1 } }
    );
    console.log(`${result.modifiedCount} records updated`);
  } catch (err) {
    console.error("Error updating records:", err);
  }
}

addStatusToExisting();
