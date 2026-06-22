const mongoose = require('mongoose');

const getBranchKey = (name = '') => {
    const normalized = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['hq', 'headoffice', 'headquarters', 'headofficebranch'].includes(normalized)) {
        return 'hq';
    }
    return normalized;
};

const branchSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    address: { 
        type: String, 
        required: true 
    },
    branchKey: {
        type: String,
        index: true
    },
    branchType: {
        type: String,
        enum: ['head_office', 'branch'],
        default: 'branch'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    mergedIntoBranchId: {
        type: String,
        default: ''
    },
    mergedAt: {
        type: Date
    }
}, { timestamps: true });

branchSchema.pre('validate', function setBranchIdentity() {
    this.branchKey = getBranchKey(this.name);
    if (this.branchKey === 'hq') {
        this.branchType = 'head_office';
    }
});

const Branch = mongoose.model('Branch', branchSchema);
Branch.getBranchKey = getBranchKey;
module.exports = Branch;
