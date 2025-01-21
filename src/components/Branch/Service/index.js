const Branch = require('../Model/index'); 
const mongoose = require('mongoose');

const createBranch = async (data) => {
    try {
        const branch = new Branch(data);
        await branch.save();
        return branch;
    } catch (error) {
        throw error;
    }
};

const getBranch = async () => {
    try {
        return await Branch.find({});
    } catch (error) {
        throw error;
    }
};
const getBranchById = async (branchId) =>{
    try {
        return await Branch.findOne({_id:branchId});
    } catch (error) {
        throw error;
    }
  }

module.exports = {
    createBranch,
    getBranch,
    getBranchById
};