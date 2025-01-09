const Customer = require('../../Customer/Model/index');
const Staff = require('../../Staff/Model/index');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
require('dotenv').config()

const customerLogin = async (email, password) => {
    try {
        const customer = await Customer.findOne({ email });
        if (!customer) {
            throw new Error('Invalid email or password');
        }

        const isMatch = await bcrypt.compare(password, customer.password);
        if (!isMatch) {
            throw new Error('Invalid email or password');
        }
        const token = jwt.sign({ id: customer._id, email: customer.email },
            process.env.JWT_SECRET_KEY, { expiresIn: process.env.JWT_LIFETIME }
        );
        return {customer,token};
    } catch (error) {
        throw error;
    }
};
const staffLogin = async (email, password) => {
    try {
        const staff = await Staff.findOne({ email });
        if (!staff) {
            throw new Error('Invalid email or password');
        }

        const isMatch = await bcrypt.compare(password, staff.password);
        if (!isMatch) {
            throw new Error('Invalid email or password');
        }
        const token = jwt.sign({ id: staff._id, email: staff.email },
            process.env.JWT_SECRET_KEY, { expiresIn: process.env.JWT_LIFETIME }
        );
        return {staff,token};
    } catch (error) {
        throw error;
    }
};

module.exports = {
    customerLogin,
    staffLogin
};
