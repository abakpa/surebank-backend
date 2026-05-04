const express = require('express');
const router = express.Router();
const ProductCategoryController = require('../Controller/index');
const { staffAuth } = require('../../Middleware/index');
const { uploadCategoryImage } = require('../../Upload/index');

// Public routes (for e-commerce storefront)
router.get('/', ProductCategoryController.getAllCategories);

// Admin routes (for backoffice) - with image upload
router.get('/admin/all', staffAuth, ProductCategoryController.getAllCategoriesAdmin);
router.post('/', staffAuth, uploadCategoryImage, ProductCategoryController.createCategory);
router.put('/:id', staffAuth, uploadCategoryImage, ProductCategoryController.updateCategory);
router.patch('/:id/toggle-status', staffAuth, ProductCategoryController.toggleCategoryStatus);
router.delete('/:id', staffAuth, ProductCategoryController.deleteCategory);
router.get('/:id', ProductCategoryController.getCategoryById);

module.exports = router;
