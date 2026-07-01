const mongoose = require('mongoose');

const sbAccountItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    ref: 'Product'
  },
  variationId: {
    type: String,
    default: ''
  },
  productName: {
    type: String,
    required: true
  },
  productDescription: {
    type: String,
    default: ''
  },
  quantity: {
    type: Number,
    default: 1
  },
  price: {
    type: Number,
    default: 0
  },
  costPrice: {
    type: Number,
    default: 0
  },
  subtotal: {
    type: Number,
    default: 0
  },
  addedAt: {
    type: Date
  },
  costSubtotal: {
    type: Number,
    default: 0
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  profitAmount: {
    type: Number,
    default: 0
  },
  profitReported: {
    type: Boolean,
    default: false
  },
  profitReportedAt: {
    type: Date
  },
  requiresCostApproval: {
    type: Boolean,
    default: false
  },
  costApprovedBy: {
    type: String,
    ref: 'Staff'
  },
  costApprovedAt: {
    type: Date
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
});

const sbaccountSchema = new mongoose.Schema({
  customerId: {
    type: String,
    ref:'Customer',
    required: true
  },
  accountNumber: { 
    type: String, 
    required: true 
},
SBAccountNumber: { 
    type: String, 
    required: true 
},
  createdBy: {
    type: String,
    ref:'Staff',
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  productDescription: {
    type: String,
    required: true,
  },
  items: {
    type: [sbAccountItemSchema],
    default: []
  },
  accountMode: {
    type: String,
    enum: ['legacy', 'multi_item'],
    default: 'legacy'
  },
  editedBy: {
    type: String,
    default:"No edit",
  },
  accountManagerId: {
    type: String,
  },
  paymentReference: {
    type: String,
    unique: true,
    sparse: true,
  },
  branchId: { 
    type: String, 
    ref:'Branch'
  },
  status: { 
    type: String, 
    required: true
  },
  startDate: { 
    type: String, 
    required: true
  },
    sellingPrice: { 
    type: Number, 
    required: true
  },
  costPrice: { 
    type: Number, 
    default:0,
  },
  balance: { 
    type: Number, 
    default:0,
  },
  profit: { 
    type: Number, 
    default: 0,
  }
},
{timestamps:true}
);

const SBAccount = mongoose.model('SBAccount', sbaccountSchema);

module.exports = SBAccount;
