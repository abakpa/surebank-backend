const express = require('express');
const router = express.Router();
const ProductCategoryController = require('../Controller/index');
const { staffAuth, productManagerOnly } = require('../../Middleware/index');
const { uploadCategoryImage } = require('../../Upload/index');

// Public routes (for e-commerce storefront)
router.get('/', ProductCategoryController.getAllCategories);

// Admin routes (for backoffice) - with image upload
router.get('/admin/all', staffAuth, ProductCategoryController.getAllCategoriesAdmin);
router.post('/', staffAuth, productManagerOnly, uploadCategoryImage, ProductCategoryController.createCategory);
router.put('/:id', staffAuth, productManagerOnly, uploadCategoryImage, ProductCategoryController.updateCategory);
router.patch('/:id/toggle-status', staffAuth, productManagerOnly, ProductCategoryController.toggleCategoryStatus);
router.delete('/:id', staffAuth, productManagerOnly, ProductCategoryController.deleteCategory);
router.get('/:id', ProductCategoryController.getCategoryById);

module.exports = router;
