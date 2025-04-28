// services/smsService.js

const SBAccount = require('../../SBAccount/Model/index');
const DSAccount = require('../../DSAccount/Model/index');

// Simulated SMS sender function (Replace with actual API call)
const sendSMS = (phone, message) => {
  console.log(`Sending SMS to ${phone}: ${message}`);
  // You can integrate with an SMS API like Twilio or Termii here
};

const sendBulkSMSToSB = async (message) => {
  const users = await SBAccount.find({}).populate('customerId');
  users.forEach((account) => {
    const phone = account.customerId?.phone;
    if (phone) sendSMS(phone, message);
  });
  return { success: true, message: 'Bulk SMS sent to SB customers' };
};

const sendBulkSMSToDS = async (message) => {
  const users = await DSAccount.find({}).populate('customerId');
  users.forEach((account) => {
    const phone = account.customerId?.phone;
    if (phone) sendSMS(phone, message);
  });
  return { success: true, message: 'Bulk SMS sent to DS customers' };
};

module.exports = {
  sendBulkSMSToSB,
  sendBulkSMSToDS,
};
