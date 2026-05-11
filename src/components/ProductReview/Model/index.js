const mongoose = require('mongoose');

const platformReviewSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    index: true
  },
  customerId: {
    type: String,
    ref: 'Customer',
    required: true
  },
  customerName: {
    type: String,
    default: 'Customer'
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    required: true,
    trim: true
  },
  showOnEcommerce: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

platformReviewSchema.index({ orderNumber: 1, customerId: 1 }, { unique: true });

const ProductReview = mongoose.model('ProductReview', platformReviewSchema);

module.exports = ProductReview;
