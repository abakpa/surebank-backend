const express = require('express');
const router = express.Router();
const ProductReviewController = require('../Controller/index');
const { customerAuth, staffAuth, adminOnly, staffExceptProductManager } = require('../../Middleware/index');

router.get('/', ProductReviewController.getPublicReviews);
router.post('/', customerAuth, ProductReviewController.createReview);

router.get('/admin/all', staffAuth, staffExceptProductManager, ProductReviewController.getAllReviewsAdmin);
router.put('/admin/:id/visibility', staffAuth, adminOnly, ProductReviewController.updateReviewVisibility);

module.exports = router;
