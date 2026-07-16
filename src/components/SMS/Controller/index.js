// controllers/smsController.js

const smsService = require('../Service/index');

const sendSMSToSBAccounts = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const result = await smsService.sendBulkSMSToSB(message);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending SMS to SB accounts:', error);
    res.status(500).json({ error: 'Failed to send SMS to SB accounts' });
  }
};

const sendSMSToDSAccounts = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const result = await smsService.sendBulkSMSToDS(message);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending SMS to DS accounts:', error);
    res.status(500).json({ error: 'Failed to send SMS to DS accounts' });
  }
};

module.exports = {
  sendSMSToSBAccounts,
  sendSMSToDSAccounts,
};
