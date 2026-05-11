const ProductReviewService = require('../Service/index');

const getPublicReviews = async (req, res) => {
  try {
    const reviews = await ProductReviewService.getPublicReviews();
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllReviewsAdmin = async (req, res) => {
  try {
    const reviews = await ProductReviewService.getAllReviewsAdmin();
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createReview = async (req, res) => {
  try {
    const review = await ProductReviewService.createReview({
      orderNumber: req.body.orderNumber,
      customerId: req.customer.customerId,
      rating: req.body.rating,
      review: req.body.review
    });

    res.status(201).json({
      message: 'Review submitted and awaiting approval',
      review
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateReviewVisibility = async (req, res) => {
  try {
    if (req.staff.role !== 'Admin') {
      return res.status(403).json({ message: 'Only admin can update review visibility' });
    }

    const review = await ProductReviewService.updateReviewVisibility(
      req.params.id,
      req.body.showOnEcommerce
    );

    res.status(200).json({
      message: 'Review visibility updated',
      review
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPublicReviews,
  getAllReviewsAdmin,
  createReview,
  updateReviewVisibility
};
