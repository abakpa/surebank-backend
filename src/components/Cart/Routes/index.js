const express = require('express');
const router = express.Router();
const CartController = require('../Controller/index');
const { customerAuth } = require('../../Middleware/index');

// Optional auth middleware - allows both guests and logged-in users
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const jwt = require("jsonwebtoken");
      const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
      req.customer = { customerId: payload.id, phone: payload.phone };
    } catch (error) {
      // Invalid token, continue as guest
    }
  }
  next();
};

// Cart routes (work for both guests and authenticated users)
router.get('/', optionalAuth, CartController.getCart);
router.post('/add', optionalAuth, CartController.addToCart);
router.put('/update', optionalAuth, CartController.updateCartItem);
router.delete('/remove/:productId', optionalAuth, CartController.removeFromCart);
router.delete('/clear', optionalAuth, CartController.clearCart);

// Merge cart requires authentication
router.post('/merge', customerAuth, CartController.mergeCart);

module.exports = router;
