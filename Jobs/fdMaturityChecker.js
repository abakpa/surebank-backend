const cron = require('node-cron');
const FDAccount = require('../src/components/FDAccount/Model/index'); // adjust path based on your structure
const { 
  blockAllUsersService,
  unblockAllUsersService 
} = require('../src/components/Login/Service/index');

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

// Schedule blocking non-admins at 8:00 PM daily
const scheduleBlocking = () => {
  cron.schedule('10 10 * * *', async () => {
    console.log('Running 8PM block of non-admin users...');
    try {
      const result = await blockAllUsersService();
      console.log('Blocking result:', result);
    } catch (error) {
      console.error('8PM blocking failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "Africa/Lagos" // Set your timezone
  });
};

// Schedule unblocking at 7:00 AM daily
const scheduleUnblocking = () => {
  cron.schedule('15 10 * * *', async () => {
    console.log('Running 7AM unblock of all users...');
    try {
      const result = await unblockAllUsersService();
      console.log('Unblocking result:', result);
    } catch (error) {
      console.error('7AM unblocking failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "Africa/Lagos" // Set your timezone
  });
};

const initAllCronJobs = () => {
  startFDMaturityJob();
  scheduleBlocking();
  scheduleUnblocking();
  console.log('🔄 All cron jobs initialized');
};

module.exports = { initAllCronJobs, startFDMaturityJob };
