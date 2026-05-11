const Product = require('../Model/index');
const ProductCategory = require('../../ProductCategory/Model/index');

const parseBoolean = (value) => value === true || value === 'true';

const parseJsonField = (value, fallback) => {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return value;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error('Invalid variation data');
  }
};

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeProductData = (productData) => {
  const normalized = { ...productData };
  const hasVariationPayload =
    Object.prototype.hasOwnProperty.call(normalized, 'hasVariations') ||
    Object.prototype.hasOwnProperty.call(normalized, 'variationOptions') ||
    Object.prototype.hasOwnProperty.call(normalized, 'variations');

  if (Object.prototype.hasOwnProperty.call(normalized, 'hasVariations')) {
    normalized.hasVariations = parseBoolean(normalized.hasVariations);
  }
  normalized.allowInstallment = normalized.allowInstallment === undefined
    ? normalized.allowInstallment
    : parseBoolean(normalized.allowInstallment);
  normalized.isActive = normalized.isActive === undefined
    ? normalized.isActive
    : parseBoolean(normalized.isActive);

  if (normalized.price !== undefined) normalized.price = normalizeNumber(normalized.price);
  if (normalized.costPrice !== undefined) normalized.costPrice = normalizeNumber(normalized.costPrice);
  if (normalized.profit !== undefined) normalized.profit = normalizeNumber(normalized.profit);
  if (normalized.stock !== undefined) normalized.stock = normalizeNumber(normalized.stock);
  if (normalized.minInstallmentAmount !== undefined) normalized.minInstallmentAmount = normalizeNumber(normalized.minInstallmentAmount);

  if (!hasVariationPayload) {
    return normalized;
  }

  normalized.variationOptions = parseJsonField(normalized.variationOptions, []);
  normalized.variations = parseJsonField(normalized.variations, []);

  if (!normalized.hasVariations) {
    normalized.variationOptions = [];
    normalized.variations = [];
    return normalized;
  }

  normalized.variationOptions = (normalized.variationOptions || [])
    .map((option) => ({
      name: String(option.name || '').trim(),
      values: Array.isArray(option.values)
        ? option.values.map((value) => String(value || '').trim()).filter(Boolean)
        : []
    }))
    .filter((option) => option.name && option.values.length > 0);

  normalized.variations = (normalized.variations || [])
    .map((variation) => {
      const optionValues = variation.optionValues && typeof variation.optionValues === 'object'
        ? variation.optionValues
        : {};
      const price = normalizeNumber(variation.price);
      const costPrice = normalizeNumber(variation.costPrice);

      return {
        name: String(variation.name || '').trim(),
        optionValues,
        price,
        costPrice,
        profit: normalizeNumber(variation.profit, price - costPrice),
        stock: normalizeNumber(variation.stock),
        sku: String(variation.sku || '').trim(),
        image: String(variation.image || '').trim(),
        isActive: variation.isActive === undefined ? true : parseBoolean(variation.isActive)
      };
    })
    .filter((variation) => variation.name && variation.price >= 0);

  if (normalized.variationOptions.length === 0) {
    throw new Error('Add at least one variation option');
  }

  if (normalized.variations.length === 0) {
    throw new Error('Add at least one product variation');
  }

  const activeVariations = normalized.variations.filter((variation) => variation.isActive !== false);
  const displayVariation = activeVariations.length > 0
    ? activeVariations.reduce((lowest, variation) => (
      variation.price < lowest.price ? variation : lowest
    ), activeVariations[0])
    : normalized.variations[0];

  normalized.price = displayVariation.price;
  normalized.costPrice = displayVariation.costPrice;
  normalized.profit = displayVariation.profit;
  normalized.stock = normalized.variations.reduce((sum, variation) => sum + variation.stock, 0);

  return normalized;
};

const validateCategoryAndSubcategory = async (productData, existingProduct = null) => {
  const categoryId = productData.categoryId || existingProduct?.categoryId;
  const subCategoryId =
    Object.prototype.hasOwnProperty.call(productData, 'subCategoryId')
      ? productData.subCategoryId
      : existingProduct?.subCategoryId;

  const category = await ProductCategory.findById(categoryId);
  if (!category) {
    throw new Error('Category not found');
  }

  if (subCategoryId) {
    const matchingSubCategory = (category.subcategories || []).find(
      (subCategory) =>
        subCategory._id.toString() === String(subCategoryId) &&
        subCategory.isActive !== false
    );

    if (!matchingSubCategory) {
      throw new Error('Subcategory not found for selected category');
    }
  }

  return category;
};

const createProduct = async (productData) => {
  productData = normalizeProductData(productData);
  await validateCategoryAndSubcategory(productData);

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

  if (filters.subCategoryId) {
    query.subCategoryId = filters.subCategoryId;
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
  updateData = normalizeProductData(updateData);
  if (updateData.categoryId || Object.prototype.hasOwnProperty.call(updateData, 'subCategoryId')) {
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      throw new Error('Product not found');
    }

    await validateCategoryAndSubcategory(updateData, existingProduct);
  }

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

const updateProductStock = async (productId, quantity, operation = 'decrease', variationId = '') => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  if (variationId) {
    const variation = product.variations.id(variationId);
    if (!variation) {
      throw new Error('Product variation not found');
    }

    const newVariationStock = operation === 'decrease'
      ? variation.stock - quantity
      : variation.stock + quantity;

    if (newVariationStock < 0) {
      throw new Error('Insufficient stock');
    }

    variation.stock = newVariationStock;
    product.stock = product.variations.reduce((sum, item) => sum + Number(item.stock || 0), 0);
    return await product.save();
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
