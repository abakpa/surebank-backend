const CartService = require('../Service/index');

const getCart = async (req, res) => {
  try {
    let identifier = {};

    if (req.customer) {
      identifier.customerId = req.customer.customerId;
    } else if (req.query.sessionId) {
      identifier.sessionId = req.query.sessionId;
    } else {
      return res.status(400).json({ message: 'Session ID or authentication required' });
    }

    const cart = await CartService.getCart(identifier);
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addToCart = async (req, res) => {
  try {
    const { productId, quantity, sessionId } = req.body;

    let identifier = {};
    if (req.customer) {
      identifier.customerId = req.customer.customerId;
    } else if (sessionId) {
      identifier.sessionId = sessionId;
    } else {
      return res.status(400).json({ message: 'Session ID or authentication required' });
    }

    const cart = await CartService.addToCart(identifier, productId, quantity || 1);

    res.status(200).json({
      message: 'Item added to cart',
      cart
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity, sessionId } = req.body;

    let identifier = {};
    if (req.customer) {
      identifier.customerId = req.customer.customerId;
    } else if (sessionId) {
      identifier.sessionId = sessionId;
    } else {
      return res.status(400).json({ message: 'Session ID or authentication required' });
    }

    const cart = await CartService.updateCartItem(identifier, productId, quantity);

    res.status(200).json({
      message: 'Cart updated',
      cart
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const productId = req.params.productId;
    const sessionId = req.query.sessionId;

    let identifier = {};
    if (req.customer) {
      identifier.customerId = req.customer.customerId;
    } else if (sessionId) {
      identifier.sessionId = sessionId;
    } else {
      return res.status(400).json({ message: 'Session ID or authentication required' });
    }

    const cart = await CartService.removeFromCart(identifier, productId);

    res.status(200).json({
      message: 'Item removed from cart',
      cart
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const clearCart = async (req, res) => {
  try {
    const sessionId = req.query.sessionId;

    let identifier = {};
    if (req.customer) {
      identifier.customerId = req.customer.customerId;
    } else if (sessionId) {
      identifier.sessionId = sessionId;
    } else {
      return res.status(400).json({ message: 'Session ID or authentication required' });
    }

    const cart = await CartService.clearCart(identifier);

    res.status(200).json({
      message: 'Cart cleared',
      cart
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const mergeCart = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!req.customer) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const cart = await CartService.mergeGuestCartToCustomer(
      sessionId,
      req.customer.customerId
    );

    res.status(200).json({
      message: 'Cart merged successfully',
      cart
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  mergeCart
};
