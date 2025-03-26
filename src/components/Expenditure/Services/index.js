const Expenditure = require('../Model/index'); 
const mongoose = require('mongoose');

const createExpenditure = async (data) => {
    try {
        const expenditure = new Expenditure(data);
        await expenditure.save();
        return expenditure;
    } catch (error) {
        throw error;
    }
};

const getExpenditure = async () => {
    try {
        return await Expenditure.find({});
    } catch (error) {
        throw error;
    }
};
const getExpenditureById = async (expenditureId) =>{
    try {
        return await Expenditure.findOne({_id:expenditureId});
    } catch (error) {
        throw error;
    }
  }

module.exports = {
    createExpenditure,
    getExpenditure,
    getExpenditureById
};