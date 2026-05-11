const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    ref: 'Product',
    required: true
  },
  variationId: {
    type: String,
    default: ''
  },
  variationName: {
    type: String,
    default: ''
  },
  selectedOptions: {
    type: Map,
    of: String,
    default: {}
  },
  productName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  subtotal: {
    type: Number,
    required: true
  },
  image: {
    type: String
  }
}, { _id: true });

const cartSchema = new mongoose.Schema({
  customerId: {
    type: String,
    ref: 'Customer'
  },
  sessionId: {
    type: String
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  },
  totalItems: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Index for quick lookup by customer or session
cartSchema.index({ customerId: 1 });
cartSchema.index({ sessionId: 1 });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
