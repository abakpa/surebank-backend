const ProductReview = require('../Model/index');
const Customer = require('../../Customer/Model/index');
const EcommerceOrder = require('../../EcommerceOrder/Model/index');

const getPublicReviews = async () => {
  return await ProductReview.find({ showOnEcommerce: true })
    .sort({ createdAt: -1 });
};

const getAllReviewsAdmin = async () => {
  return await ProductReview.find({})
    .sort({ createdAt: -1 });
};

const createReview = async ({ orderNumber, customerId, rating, review }) => {
  const order = await EcommerceOrder.findOne({ orderNumber, customerId });
  if (!order) {
    throw new Error('Order not found');
  }

  if (!['paid', 'partial'].includes(order.paymentStatus)) {
    throw new Error('Review can only be submitted after successful payment');
  }

  const normalizedRating = Number(rating);
  if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  if (!review || String(review).trim().length < 3) {
    throw new Error('Review must be at least 3 characters');
  }

  const customer = await Customer.findById(customerId);
  const customerName = customer
    ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
    : 'Customer';

  return await ProductReview.findOneAndUpdate(
    { orderNumber, customerId },
    {
      $set: {
        orderNumber,
        rating: normalizedRating,
        review: String(review).trim(),
        customerName: customerName || 'Customer',
        showOnEcommerce: false
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const updateReviewVisibility = async (reviewId, showOnEcommerce) => {
  const review = await ProductReview.findByIdAndUpdate(
    reviewId,
    { $set: { showOnEcommerce: Boolean(showOnEcommerce) } },
    { new: true }
  );

  if (!review) {
    throw new Error('Review not found');
  }

  return review;
};

module.exports = {
  getPublicReviews,
  getAllReviewsAdmin,
  createReview,
  updateReviewVisibility
};
