const express = require('express');
const router = express.Router();
const ProductCategoryController = require('../Controller/index');
const { staffAuth, adminOnly } = require('../../Middleware/index');
const { uploadCategoryImage } = require('../../Upload/index');

// Public routes (for e-commerce storefront)
router.get('/', ProductCategoryController.getAllCategories);

// Admin routes (for backoffice) - with image upload
router.get('/admin/all', staffAuth, ProductCategoryController.getAllCategoriesAdmin);
router.post('/', staffAuth, adminOnly, uploadCategoryImage, ProductCategoryController.createCategory);
router.put('/:id', staffAuth, adminOnly, uploadCategoryImage, ProductCategoryController.updateCategory);
router.patch('/:id/toggle-status', staffAuth, adminOnly, ProductCategoryController.toggleCategoryStatus);
router.delete('/:id', staffAuth, adminOnly, ProductCategoryController.deleteCategory);
router.get('/:id', ProductCategoryController.getCategoryById);

module.exports = router;
