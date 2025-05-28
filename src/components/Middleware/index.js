const jwt = require("jsonwebtoken");

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
        console.log(error);
        res.send("invalid authentication");
    }
};
const staffAuth = async(req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.send("Authentication invalid");
    }
    const token = authHeader.split(" ")[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);

        req.staff = { staffId: payload.id, phone: payload.phone };

        next();
    } catch (error) {
        if (error) return res.status(401).json({ message: 'Token expired or invalid' });

        console.log(error);
        // res.send("invalid authentication");
    }
};
module.exports = {
    customerAuth,
    staffAuth
}