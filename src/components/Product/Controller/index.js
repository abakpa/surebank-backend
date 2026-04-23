const ProductService = require('../Service/index');

const createProduct = async (req, res) => {
  try {
    const createdBy = req.staff.staffId;
    const {
      name,
      description,
      categoryId,
      costPrice,
      price,
      profit,
      images,
      stock,
      sku,
      isActive,
      allowInstallment,
      minInstallmentAmount,
      branchId
    } = req.body;

    const product = await ProductService.createProduct({
      name,
      description,
      categoryId,
      costPrice: costPrice || 0,
      price,
      profit: profit || 0,
      images,
      stock,
      sku,
      isActive,
      allowInstallment,
      minInstallmentAmount,
      branchId,
      createdBy
    });

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const { categoryId, minPrice, maxPrice, search } = req.query;
    const products = await ProductService.getAllProducts({
      categoryId,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      search
    });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllProductsAdmin = async (req, res) => {
  try {
    const products = await ProductService.getAllProductsAdmin();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await ProductService.getProductById(productId);
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductsByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const products = await ProductService.getProductsByCategory(categoryId);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updateData = req.body;

    const product = await ProductService.updateProduct(productId, updateData);

    res.status(200).json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const result = await ProductService.deleteProduct(productId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateStock = async (req, res) => {
  try {
    const productId = req.params.id;
    const { quantity, operation } = req.body;

    const product = await ProductService.updateProductStock(productId, quantity, operation);

    res.status(200).json({
      message: 'Stock updated successfully',
      product
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFeaturedProducts = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 8;
    const products = await ProductService.getFeaturedProducts(limit);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getAllProductsAdmin,
  getProductById,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
  updateStock,
  getFeaturedProducts
};
