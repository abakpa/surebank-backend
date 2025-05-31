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
    staffLogin
};
