const expenditureService = require('../Services/index'); 
require('dotenv').config()
const Staff = require('../../Staff/Model/index');

const createExpenditure = async (req, res) => {
    const staffBranch = await Staff.findById(createdBy)
    const {amount,reason} = req.body
    const detail = {
        amount,
        reason,
        createdBy,
        branchId:staffBranch.branchId
    }
    try {
        const expenditure = await expenditureService.createExpenditure(detail);
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
            const expenditure = await expenditureService.getExpenditureById(expenditureId);
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