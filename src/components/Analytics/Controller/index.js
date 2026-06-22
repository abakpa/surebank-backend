const AnalyticsService = require('../Service');

const getAnalytics = async (req, res) => {
  try {
    const analytics = await AnalyticsService.getAnalytics({ days: req.query.days || 30 });
    res.status(200).json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAnalytics
};
