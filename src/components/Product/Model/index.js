const mongoose = require('mongoose');

const productVariationOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  values: [{
    type: String
  }]
}, { _id: false });

const productVariationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  optionValues: {
    type: Map,
    of: String,
    default: {}
  },
  price: {
    type: Number,
    required: true
  },
  costPrice: {
    type: Number,
    default: 0
  },
  profit: {
    type: Number,
    default: 0
  },
  stock: {
    type: Number,
    default: 0
  },
  sku: {
    type: String
  },
  image: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  categoryId: {
    type: String,
    ref: 'ProductCategory',
    required: true
  },
  subCategoryId: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true
  },
  costPrice: {
    type: Number,
    default: 0
  },
  profit: {
    type: Number,
    default: 0
  },
  images: [{
    type: String
  }],
  hasVariations: {
    type: Boolean,
    default: false
  },
  variationOptions: [productVariationOptionSchema],
  variations: [productVariationSchema],
  stock: {
    type: Number,
    default: 0
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  allowInstallment: {
    type: Boolean,
    default: true
  },
  minInstallmentAmount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: String,
    ref: 'Staff',
    required: true
  },
  branchId: {
    type: String,
    ref: 'Branch'
  }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
