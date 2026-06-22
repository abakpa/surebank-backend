const mongoose = require('mongoose');

const installmentPaymentSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue'],
    default: 'pending'
  },
  paidAt: {
    type: Date
  },
  transactionRef: {
    type: String
  }
}, { _id: true });

const orderItemSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  fulfillmentStatus: {
    type: String,
    enum: ['pending', 'delivered', 'completed'],
    default: 'pending'
  },
  fulfilledAt: {
    type: Date
  },
  fulfilledBy: {
    type: String,
    ref: 'Staff'
  }
}, { _id: true });

const ecommerceOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  customerId: {
    type: String,
    ref: 'Customer',
    required: true
  },
  accountNumber: {
    type: String,
    required: true
  },
  SBAccountNumber: {
    type: String
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentType: {
    type: String,
    enum: ['outright', 'installment'],
    required: true
  },
  installmentPlan: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'flexible']
    },
    duration: {
      type: Number
    },
    amountPerPeriod: {
      type: Number
    },
    totalPaid: {
      type: Number,
      default: 0
    },
    remainingBalance: {
      type: Number
    },
    nextPaymentDate: {
      type: Date
    },
    payments: [installmentPaymentSchema]
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'paid', 'partially_paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  shippingAddress: {
    type: String,
    required: true
  },
  shippingCity: {
    type: String
  },
  shippingState: {
    type: String
  },
  customerPhone: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String
  },
  notes: {
    type: String
  },
  accountManagerId: {
    type: String,
    ref: 'Staff'
  },
  branchId: {
    type: String,
    ref: 'Branch'
  },
  processedBy: {
    type: String,
    ref: 'Staff'
  },
  paymentReference: {
    type: String,
    unique: true,
    sparse: true
  }
}, { timestamps: true });

const EcommerceOrder = mongoose.model('EcommerceOrder', ecommerceOrderSchema);

module.exports = EcommerceOrder;
