const Cart = require('../Model/index');
const Product = require('../../Product/Model/index');

const CUSTOMER_PRICE_BLOCK_AMOUNT = 2500;
const CUSTOMER_PRICE_BLOCK_FEE = 145;

const normalizeMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const calculateCustomerSellingPrice = (basePrice) => {
  const normalizedBasePrice = Number(basePrice || 0);
  if (normalizedBasePrice <= 0) return 0;

  const feeBlocks = Math.ceil(normalizedBasePrice / CUSTOMER_PRICE_BLOCK_AMOUNT);
  return normalizeMoney(normalizedBasePrice + (feeBlocks * CUSTOMER_PRICE_BLOCK_FEE));
};

const calculatePayOnceSellingPrice = calculateCustomerSellingPrice;
const calculatePaySmallSmallSellingPrice = calculateCustomerSellingPrice;

const getVariationSelection = (product, variationId) => {
  if (!product.hasVariations) {
    return null;
  }

  if (!variationId) {
    throw new Error('Please select a product variation');
  }

  const variation = product.variations.id(variationId);
  if (!variation || variation.isActive === false) {
    throw new Error('Product variation is not available');
  }

  return variation;
};

const getSelectedOptions = (variation) => {
  if (!variation?.optionValues) {
    return {};
  }

  return variation.optionValues instanceof Map
    ? Object.fromEntries(variation.optionValues)
    : variation.optionValues;
};

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

const refreshCartVisiblePrices = async (cart) => {
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return cart;
  }

  for (const item of cart.items) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    const variation = item.variationId ? product.variations.id(item.variationId) : null;
    const basePrice = variation ? variation.price : product.price;
    const visiblePrice = calculateCustomerSellingPrice(basePrice);
    const quantity = Number(item.quantity || 1);

    item.price = visiblePrice;
    item.subtotal = visiblePrice * quantity;
    item.productName = product.name || item.productName;
    item.variationName = variation?.name || item.variationName || '';
    item.selectedOptions = variation ? getSelectedOptions(variation) : item.selectedOptions || {};
  }

  cart.totalAmount = cart.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  cart.totalItems = cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return await cart.save();
};

const addToCart = async (identifier, productId, quantity = 1, skipStockCheck = false, variationId = '') => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  if (!product.isActive) {
    throw new Error('Product is not available');
  }

  const variation = getVariationSelection(product, variationId);
  const selectedStock = variation ? variation.stock : product.stock;
  const basePrice = variation ? variation.price : product.price;
  const selectedPrice = calculateCustomerSellingPrice(basePrice);
  const selectedImage = variation?.image || (product.images && product.images.length > 0 ? product.images[0] : '');
  const normalizedVariationId = variation ? variation._id.toString() : '';

  // Only check stock if not skipping (for regular cart operations)
  if (!skipStockCheck && selectedStock < quantity) {
    throw new Error('Insufficient stock');
  }

  let cart = await getOrCreateCart(identifier);

  const existingItemIndex = cart.items.findIndex(
    item => item.productId === productId && (item.variationId || '') === normalizedVariationId
  );

  if (existingItemIndex > -1) {
    const nextQuantity = Number(cart.items[existingItemIndex].quantity || 0) + Number(quantity || 0);
    if (!skipStockCheck && selectedStock < nextQuantity) {
      throw new Error('Insufficient stock');
    }
    cart.items[existingItemIndex].price = selectedPrice;
    cart.items[existingItemIndex].quantity += quantity;
    cart.items[existingItemIndex].subtotal = selectedPrice * cart.items[existingItemIndex].quantity;
  } else {
    cart.items.push({
      productId: product._id.toString(),
      variationId: normalizedVariationId,
      variationName: variation?.name || '',
      selectedOptions: variation ? getSelectedOptions(variation) : {},
      productName: product.name,
      price: selectedPrice,
      quantity,
      subtotal: selectedPrice * quantity,
      image: selectedImage
    });
  }

  // Recalculate totals
  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return await cart.save();
};

const updateCartItem = async (identifier, productId, quantity, skipStockCheck = false, variationId = '') => {
  let cart = await getOrCreateCart(identifier);

  const itemIndex = cart.items.findIndex(
    item => item.productId === productId && (item.variationId || '') === (variationId || '')
  );

  if (itemIndex === -1) {
    throw new Error('Item not found in cart');
  }

  if (quantity <= 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    const variation = getVariationSelection(product, variationId);
    const selectedStock = variation ? variation.stock : product.stock;
    // Only check stock if not skipping (for regular cart operations)
    if (!skipStockCheck && selectedStock < quantity) {
      throw new Error('Insufficient stock');
    }
    const basePrice = variation ? variation.price : product.price;
    const visiblePrice = calculateCustomerSellingPrice(basePrice);
    cart.items[itemIndex].price = visiblePrice;
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].subtotal = visiblePrice * quantity;
  }

  // Recalculate totals
  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return await cart.save();
};

const removeFromCart = async (identifier, productId, variationId = '') => {
  let cart = await getOrCreateCart(identifier);

  cart.items = cart.items.filter(
    item => !(item.productId === productId && (item.variationId || '') === (variationId || ''))
  );

  // Recalculate totals
  cart.totalAmount = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return await cart.save();
};

const getCart = async (identifier) => {
  const cart = await getOrCreateCart(identifier);
  return await refreshCartVisiblePrices(cart);
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
      item => item.productId === guestItem.productId && (item.variationId || '') === (guestItem.variationId || '')
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

  return await refreshCartVisiblePrices(customerCart);
};

// Get product details for payment (no stock check)
const getProductForPayment = async (productId, quantity = 1, variationId = '', paymentType = 'pay_once') => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }
  if (product.isActive === false) {
    throw new Error('Product is not available');
  }

  const variation = getVariationSelection(product, variationId);
  const basePrice = variation ? variation.price : product.price;
  const selectedPrice = calculateCustomerSellingPrice(basePrice);
  const selectedImage = variation?.image || (product.images && product.images.length > 0 ? product.images[0] : '');

  return {
    productId: product._id.toString(),
    variationId: variation ? variation._id.toString() : '',
    variationName: variation?.name || '',
    selectedOptions: variation ? getSelectedOptions(variation) : {},
    productName: product.name,
    price: selectedPrice,
    quantity,
    subtotal: selectedPrice * quantity,
    image: selectedImage
  };
};

const priceCartItemsForPaymentType = async (items = [], paymentType = 'pay_once') => {
  const pricedItems = await Promise.all((items || []).map(async (item) => {
    const plainItem = typeof item.toObject === 'function' ? item.toObject() : item;
    const product = await Product.findById(plainItem.productId);

    if (!product) {
      throw new Error(`${plainItem.productName || 'Product'} is no longer available`);
    }

    const variation = plainItem.variationId ? product.variations.id(plainItem.variationId) : null;
    const basePrice = variation ? variation.price : product.price;
    const price = calculateCustomerSellingPrice(basePrice);
    const quantity = Number(plainItem.quantity || 1);

    return {
      ...plainItem,
      price,
      quantity,
      subtotal: price * quantity,
    };
  }));

  return {
    items: pricedItems,
    totalAmount: pricedItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0),
  };
};

module.exports = {
  CUSTOMER_PRICE_BLOCK_AMOUNT,
  CUSTOMER_PRICE_BLOCK_FEE,
  calculatePayOnceSellingPrice,
  calculatePaySmallSmallSellingPrice,
  calculateCustomerSellingPrice,
  getOrCreateCart,
  refreshCartVisiblePrices,
  addToCart,
  updateCartItem,
  removeFromCart,
  getCart,
  clearCart,
  mergeGuestCartToCustomer,
  getProductForPayment,
  priceCartItemsForPaymentType
};
