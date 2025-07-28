// migrations/add-auth-fields.js
const mongoose = require('mongoose');
const Staff = require('../src/components/Staff/Model/index');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const result = await Staff.updateMany(
      { 
        $or: [
          { tokenVersion: { $exists: false } },
          { loginDisabled: { $exists: false } }
        ]
      },
      { 
        $set: { 
          tokenVersion: 0,
          loginDisabled: false
        } 
      }
    );

    // console.log(`Updated ${result.modifiedCount} Staffs`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();