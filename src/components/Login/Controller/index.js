const customerService = require('../Service/index');
const staffService = require('../Service/index');


const customerLogin = async (req, res) => {
    try {
        const { phone, password } = req.body;
        const {customer,token} = await customerService.customerLogin(phone, password);

      
        res.status(200).json({
            message: 'Login successful',
            customer: {
                id: customer._id,
                phone: customer.phone,
                branchId:customer.branchId
            },
            token
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
     const getCustomers = async (req, res) => {
        try {
            const customers = await customerService.getCustomers();
            res.status(200).json(customers);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
     const getBranchCustomers = async (req, res) => {
        const branchId = req.params.id
        try {
            const customers = await customerService.getBranchCustomers(branchId);
            res.status(200).json(customers);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
     const getRepCustomers = async (req, res) => {
        const repId = req.staff.staffId;
        try {
            const customers = await customerService.getRepCustomers(repId);
            res.status(200).json(customers);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
      }
    const blockAllUsers = async (req, res) => {
        try {
          const result = await staffService.blockAllUsersService();
          res.status(200).json(result);
        } catch (error) {
          res.status(500).json({ 
            error: error.message || 'Failed to block all users' 
          });
        }
      };
    const unblockAllUsers = async (req, res) => {
        try {
          const result = await staffService.unblockAllUsersService();
          res.status(200).json(result);
        } catch (error) {
          res.status(500).json({ 
            error: error.message || 'Failed to unblock users' 
          });
        }
      };   
const staffLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const {staff,token} = await staffService.staffLogin(email, password);
      
        res.status(200).json({
            message: 'Login successful',
            staff: {
                id: staff._id,
                firstName:staff.firstName,
                lastName:staff.lastName,
                phone: staff.phone,
                role:staff.role,
                branch:staff.branchId
            },
            token
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    customerLogin,
    staffLogin,
    getCustomers,
    blockAllUsers,
    unblockAllUsers,
    getBranchCustomers,
    getRepCustomers
};
