const Product = require('../Model/index');
const ProductCategory = require('../../ProductCategory/Model/index');

const createProduct = async (productData) => {
  // Verify category exists
  const category = await ProductCategory.findById(productData.categoryId);
  if (!category) {
    throw new Error('Category not found');
  }

  // Generate SKU if not provided
  if (!productData.sku) {
    productData.sku = 'SKU-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }

  const product = new Product(productData);
  return await product.save();
};

const getAllProducts = async (filters = {}) => {
  const query = { isActive: true };

  if (filters.categoryId) {
    query.categoryId = filters.categoryId;
  }

  if (filters.minPrice) {
    query.price = { ...query.price, $gte: filters.minPrice };
  }

  if (filters.maxPrice) {
    query.price = { ...query.price, $lte: filters.maxPrice };
  }

  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } }
    ];
  }

  const products = await Product.find(query).sort({ createdAt: -1 });
  return products;
};

const getAllProductsAdmin = async () => {
  return await Product.find({}).sort({ createdAt: -1 });
};

const getProductById = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }
  return product;
};

const getProductsByCategory = async (categoryId) => {
  return await Product.find({ categoryId, isActive: true }).sort({ createdAt: -1 });
};

const updateProduct = async (productId, updateData) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    { $set: updateData },
    { new: true }
  );
  if (!product) {
    throw new Error('Product not found');
  }
  return product;
};

const deleteProduct = async (productId) => {
  const product = await Product.findByIdAndUpdate(
    productId,
    { $set: { isActive: false } },
    { new: true }
  );
  if (!product) {
    throw new Error('Product not found');
  }
  return { message: 'Product deleted successfully' };
};

const updateProductStock = async (productId, quantity, operation = 'decrease') => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  let newStock;
  if (operation === 'decrease') {
    newStock = product.stock - quantity;
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }
  } else {
    newStock = product.stock + quantity;
  }

  product.stock = newStock;
  return await product.save();
};

const getFeaturedProducts = async (limit = 8) => {
  return await Product.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = {
  createProduct,
  getAllProducts,
  getAllProductsAdmin,
  getProductById,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
  updateProductStock,
  getFeaturedProducts
};
