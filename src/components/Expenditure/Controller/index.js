const expenditureService = require('../Services/index'); 

const createExpenditure = async (req, res) => {
    try {
        const expenditure = await expenditureService.createExpenditure(req.body);
        res.status(201).json(expenditure);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getExpenditure = async (req, res) => {
    try {
        const expenditure = await expenditureService.getExpenditure();
        res.status(200).json(expenditure);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
      const getExpenditureById = async (req, res) => {
        try {
          const expenditureId = req.params.id
            const expenditure = await expenditureService.getCustomerById(expenditureId);
            res.status(200).json(expenditure);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }

module.exports = {
    createExpenditure,
    getExpenditure,
    getExpenditureById
};