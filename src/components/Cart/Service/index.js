const Cart = require('../Model/index');
const Product = require('../../Product/Model/index');

const getOrCreateCart = async (identifier) => {
  let cart;

  if (identifier.customerId) {
    cart = await Cart.findOne({ customerId: identifier.customerId });
  } else if (identifier.sessionId) {
    cart = await Cart.findOne({ sessionId: identifier.sessionId });
  }

  if (!cart) {
    cart = new Cart({
      customerId: identifier.customerId || null,
      sessionId: identifier.sessionId || null,
      items: [],
      totalAmount: 0,
      totalItems: 0
    });
    await cart.save();
  }

  return cart;
};

const addToCart = async (identifier, productId, quantity = 1, skipStockCheck = false) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  if (!product.isActive) {
    throw new Error('Product is not available');
  }

  // Only check stock if not skipping (for regular cart operations)
  if (!skipStockCheck && product.stock < quantity) {
    throw new Error('Insufficient stock');
  }

  let cart = await getOrCreateCart(identifier);

  const existingItemIndex = cart.items.findIndex(
    item => item.productId === productId
  );

  if (existingItemIndex > -1) {
    cart.items[existingItemIndex].quantity += quantity;
    cart.items[existingItemIndex].subtotal =
      cart.items[existingItemIndex].price * cart.items[existingItemIndex].quantity;
  } else {
    cart.items.push({
      productId: product._id.toString(),
      productName: product.name,
      price: product.price,
      quantity,
      subtotal: product.price * quantity,
      image: product.images && product.images.length > 0 ? product.images[0] : ''
    });
  }

  // Recalculate totals
  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return await cart.save();
};

const updateCartItem = async (identifier, productId, quantity, skipStockCheck = false) => {
  let cart = await getOrCreateCart(identifier);

  const itemIndex = cart.items.findIndex(
    item => item.productId === productId
  );

  if (itemIndex === -1) {
    throw new Error('Item not found in cart');
  }

  if (quantity <= 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    const product = await Product.findById(productId);
    // Only check stock if not skipping (for regular cart operations)
    if (!skipStockCheck && product.stock < quantity) {
      throw new Error('Insufficient stock');
    }
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].subtotal = cart.items[itemIndex].price * quantity;
  }

  // Recalculate totals
  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return await cart.save();
};

const removeFromCart = async (identifier, productId) => {
  let cart = await getOrCreateCart(identifier);

  cart.items = cart.items.filter(item => item.productId !== productId);

  // Recalculate totals
  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return await cart.save();
};

const getCart = async (identifier) => {
  return await getOrCreateCart(identifier);
};

const clearCart = async (identifier) => {
  let cart = await getOrCreateCart(identifier);
  cart.items = [];
  cart.totalAmount = 0;
  cart.totalItems = 0;
  return await cart.save();
};

const mergeGuestCartToCustomer = async (sessionId, customerId) => {
  const guestCart = await Cart.findOne({ sessionId });
  if (!guestCart || guestCart.items.length === 0) {
    return await getOrCreateCart({ customerId });
  }

  let customerCart = await Cart.findOne({ customerId });

  if (!customerCart) {
    guestCart.customerId = customerId;
    guestCart.sessionId = null;
    return await guestCart.save();
  }

  // Merge items
  for (const guestItem of guestCart.items) {
    const existingIndex = customerCart.items.findIndex(
      item => item.productId === guestItem.productId
    );

    if (existingIndex > -1) {
      customerCart.items[existingIndex].quantity += guestItem.quantity;
      customerCart.items[existingIndex].subtotal =
        customerCart.items[existingIndex].price * customerCart.items[existingIndex].quantity;
    } else {
      customerCart.items.push(guestItem);
    }
  }

  // Recalculate totals
  customerCart.totalAmount = customerCart.items.reduce((sum, item) => sum + item.subtotal, 0);
  customerCart.totalItems = customerCart.items.reduce((sum, item) => sum + item.quantity, 0);

  await customerCart.save();
  await Cart.deleteOne({ sessionId });

  return customerCart;
};

// Get product details for payment (no stock check)
const getProductForPayment = async (productId, quantity = 1) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  return {
    productId: product._id.toString(),
    productName: product.name,
    price: product.price,
    quantity,
    subtotal: product.price * quantity,
    image: product.images && product.images.length > 0 ? product.images[0] : ''
  };
};

module.exports = {
  getOrCreateCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  getCart,
  clearCart,
  mergeGuestCartToCustomer,
  getProductForPayment
};
