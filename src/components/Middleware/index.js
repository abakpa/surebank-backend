const jwt = require("jsonwebtoken");
const Staff = require('../Staff/Model/index');


const customerAuth = async(req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authorization token missing or malformed" });
        // res.send("Authentication invalid");
    }
    const token = authHeader.split(" ")[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
        req.customer = { customerId: payload.id, phone: payload.phone };

        next();
    } catch (error) {
        return res.status(401).json({ message: 'Your login session has expired. Please login again to continue.' });

        // res.send("invalid authentication");
    }
};
const staffAuth = async(req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authorization token missing or malformed" });
    }
    const token = authHeader.split(" ")[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const staff = await Staff.findById(payload.id);
        if (staff.tokenVersion !== payload.tokenVersion) {
            throw new Error('Session expired')
            // return res.status(401).json({ error: "Session expired" });
          }

        req.staff = { staffId: payload.id, email: payload.email, role: staff.role, branchId: staff.branchId };

        next();
    } catch (error) {
        if (error) return res.status(401).json({ message: 'Your login session has expired. Please login again to continue.' });

        console.log(error);
        // res.send("invalid authentication");
    }
};
const adminOnly = (req, res, next) => {
    if (req.staff?.role !== 'Admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }

    next();
};
const productManagerOnly = (req, res, next) => {
    if (!['Admin', 'ProductManager', 'Product Manager', 'SubAdmin'].includes(req.staff?.role)) {
        return res.status(403).json({ message: 'Product manager access required' });
    }

    next();
};
const managerOnly = (req, res, next) => {
    if (req.staff?.role !== 'Manager') {
        return res.status(403).json({ message: 'Manager access required' });
    }

    next();
};
const staffExceptProductManager = (req, res, next) => {
    if (['ProductManager', 'Product Manager', 'SubAdmin'].includes(req.staff?.role)) {
        return res.status(403).json({ message: 'Product manager access is limited to products and categories' });
    }

    next();
};
module.exports = {
    customerAuth,
    staffAuth,
    adminOnly,
    managerOnly,
    productManagerOnly,
    staffExceptProductManager
}
