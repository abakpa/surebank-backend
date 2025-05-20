const cron = require('node-cron');
const FDAccount = require('../src/components/FDAccount/Model/index'); // adjust path based on your structure

// Schedule the job to run every 5 minutes
const startFDMaturityJob = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('Running FD maturity check...');

    try {
      const now = new Date();

      const result = await FDAccount.updateMany(
        {
          maturityDate: { $lte: now },
          status: { $ne: 'Matured' }
        },
        {
          $set: { status: 'Matured' }
        }
      );

      console.log(`${result.modifiedCount} account(s) updated to "Matured"`);
    } catch (error) {
      console.error('FD maturity cron job failed:', error.message);
    }
  });
};

module.exports = startFDMaturityJob;
