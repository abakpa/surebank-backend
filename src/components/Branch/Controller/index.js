const branchService = require('../Service/index'); 

const createBranch = async (req, res) => {
    try {
        const branch = await branchService.createBranch(req.body);
        res.status(201).json(branch);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getBranch = async (req, res) => {
    try {
        const branch = await branchService.getBranch();
        res.status(200).json(branch);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
      const getBranchById = async (req, res) => {
        try {
          const branchId = req.params.id
            const branch = await branchService.getCustomerById(branchId);
            res.status(200).json(branch);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }

module.exports = {
    createBranch,
    getBranch,
    getBranchById
};