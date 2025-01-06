const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    address: { 
        type: String, 
        required: true 
    }
}, { timestamps: true });

const Branch = mongoose.model('Branch', branchSchema);
module.exports = Branch;
