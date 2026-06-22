const Branch = require('../Model/index'); 
const mongoose = require('mongoose');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getDuplicateBranchQuery = (name, branchKey) => {
    const namePattern = new RegExp(`^${escapeRegex(name).replace(/\s+/g, '\\s*')}$`, 'i');
    const duplicateNames = branchKey === 'hq'
        ? [{ name: /^hq$/i }, { name: /^head\s*office$/i }, { name: /^headquarters$/i }]
        : [{ name: namePattern }];

    return {
        isActive: { $ne: false },
        $or: [
            { branchKey },
            ...duplicateNames
        ]
    };
};

const createBranch = async (data) => {
    try {
        const branchKey = Branch.getBranchKey(data.name);
        const duplicate = await Branch.findOne(getDuplicateBranchQuery(data.name, branchKey));

        if (duplicate) {
            throw new Error(`Branch already exists as ${duplicate.name}`);
        }

        const branch = new Branch({
            ...data,
            branchKey,
            branchType: branchKey === 'hq' ? 'head_office' : (data.branchType || 'branch')
        });
        await branch.save();
        return branch;
    } catch (error) {
        throw error;
    }
};

const getBranch = async () => {
    try {
        return await Branch.find({ isActive: { $ne: false } });
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
