const express = require('express');
const router = express.Router();
const ProductController = require('../Controller/index');
const { staffAuth, productManagerOnly, managerOnly } = require('../../Middleware/index');
const { uploadProductImages } = require('../../Upload/index');

// Public routes (for e-commerce storefront)
router.get('/', ProductController.getAllProducts);
router.get('/featured', ProductController.getFeaturedProducts);
router.get('/category/:categoryId', ProductController.getProductsByCategory);

// Admin routes (for backoffice) - with image upload
router.get('/admin/all', staffAuth, ProductController.getAllProductsAdmin);
router.post('/', staffAuth, productManagerOnly, uploadProductImages, ProductController.createProduct);
router.put('/:id', staffAuth, productManagerOnly, uploadProductImages, ProductController.updateProduct);
router.put('/:id/stock', staffAuth, managerOnly, ProductController.updateStock);
router.delete('/:id', staffAuth, productManagerOnly, ProductController.deleteProduct);
router.get('/:id', ProductController.getProductById);

module.exports = router;
