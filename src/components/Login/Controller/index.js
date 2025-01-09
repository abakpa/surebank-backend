const customerService = require('../Service/index');
const staffService = require('../Service/index');


const customerLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const {customer,token} = await customerService.customerLogin(email, password);

      
        res.status(200).json({
            message: 'Login successful',
            customer: {
                id: customer._id,
                email: customer.email,
            },
            token
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
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
                email: staff.email,
                role:staff.role,
                branch:staff.branch
            },
            token
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    customerLogin,
    staffLogin
};
