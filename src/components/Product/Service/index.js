const Product = require('../Model/index');
const ProductCategory = require('../../ProductCategory/Model/index');
const EcommerceOrder = require('../../EcommerceOrder/Model/index');
const SBAccount = require('../../SBAccount/Model/index');
const Branch = require('../../Branch/Model/index');
const ProductBranchStock = require('../../ProductBranchStock/Model/index');

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

const assertCostNotAbovePrice = (costPrice, price, label = 'Product') => {
  const nextCostPrice = normalizeNumber(costPrice);
  const nextPrice = normalizeNumber(price);

  if (nextCostPrice < 0) {
    throw new Error(`${label} cost price cannot be negative`);
  }

  if (nextPrice < 0) {
    throw new Error(`${label} selling price cannot be negative`);
  }

  if (nextCostPrice > nextPrice) {
    throw new Error(`${label} cost price cannot be greater than selling price`);
  }
};

const validateProductPricing = (productData, existingProduct = null) => {
  if (productData.hasVariations && Array.isArray(productData.variations) && productData.variations.length > 0) {
    productData.variations.forEach((variation) => {
      assertCostNotAbovePrice(
        variation.costPrice,
        variation.price,
        `Variation "${variation.name || 'Unnamed'}"`
      );
      variation.profit = normalizeNumber(variation.price) - normalizeNumber(variation.costPrice);
    });
    return productData;
  }

  const hasPrice = Object.prototype.hasOwnProperty.call(productData, 'price');
  const hasCostPrice = Object.prototype.hasOwnProperty.call(productData, 'costPrice');
  const effectivePrice = hasPrice ? productData.price : existingProduct?.price;
  const effectiveCostPrice = hasCostPrice ? productData.costPrice : existingProduct?.costPrice;

  if (effectivePrice !== undefined || effectiveCostPrice !== undefined) {
    assertCostNotAbovePrice(effectiveCostPrice || 0, effectivePrice || 0);
  }

  if (hasPrice || hasCostPrice || Object.prototype.hasOwnProperty.call(productData, 'profit')) {
    productData.profit = normalizeNumber(effectivePrice) - normalizeNumber(effectiveCostPrice);
  }

  return productData;
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
        _id: variation._id || variation.id,
        name: String(variation.name || '').trim(),
        optionValues,
        price,
        costPrice,
        profit: price - costPrice,
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

const mapToPlainObject = (value) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
};

const getVariationNameById = (product, variationId = '') => {
  if (!variationId || !product.hasVariations || !Array.isArray(product.variations)) {
    return '';
  }
  const variation = product.variations.id
    ? product.variations.id(variationId)
    : product.variations.find((item) => String(item._id || '') === String(variationId));
  return variation?.name || '';
};

const applyBranchStockToProduct = async (product) => {
  if (!product) return product;

  const productObject = typeof product.toObject === 'function' ? product.toObject() : { ...product };
  const [stockRows, branches] = await Promise.all([
    ProductBranchStock.find({ productId: productObject._id.toString() }).lean(),
    Branch.find({ isActive: { $ne: false } }).select('_id name').lean()
  ]);
  const branchNameById = new Map(branches.map((branch) => [branch._id.toString(), branch.name]));
  const hasBranchStockRows = stockRows.length > 0;
  const totalStock = stockRows.reduce((total, row) => total + Number(row.quantity || 0), 0);

  productObject.branchStocks = stockRows
    .map((row) => ({
      _id: row._id,
      productId: row.productId,
      branchId: row.branchId,
      branchName: branchNameById.get(String(row.branchId || '')) || 'Unknown Branch',
      variationId: row.variationId || '',
      variationName: getVariationNameById(product, row.variationId || ''),
      quantity: Number(row.quantity || 0),
      updatedAt: row.updatedAt
    }))
    .sort((a, b) => a.branchName.localeCompare(b.branchName));

  productObject.totalStock = hasBranchStockRows ? totalStock : Number(productObject.stock || 0);
  productObject.stock = productObject.totalStock;

  if (productObject.hasVariations && Array.isArray(productObject.variations)) {
    productObject.variations = productObject.variations.map((variation) => {
      const variationId = String(variation._id || '');
      const variationStockRows = stockRows.filter((row) => String(row.variationId || '') === variationId);
      return {
        ...variation,
        stock: variationStockRows.length > 0
          ? variationStockRows.reduce((total, row) => total + Number(row.quantity || 0), 0)
          : Number(variation.stock || 0)
      };
    });
  }

  return productObject;
};

const applyBranchStockToProducts = async (products) => {
  return await Promise.all(products.map((product) => applyBranchStockToProduct(product)));
};

const recalculateProductStock = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  const stockRows = await ProductBranchStock.find({ productId: productId.toString() }).lean();
  product.stock = stockRows.reduce((total, row) => total + Number(row.quantity || 0), 0);

  if (product.hasVariations && Array.isArray(product.variations)) {
    product.variations.forEach((variation) => {
      const variationId = variation._id.toString();
      variation.stock = stockRows
        .filter((row) => String(row.variationId || '') === variationId)
        .reduce((total, row) => total + Number(row.quantity || 0), 0);
    });
  }

  await product.save();
  return product;
};

const removeStockFields = (productData) => {
  const nextData = { ...productData };
  delete nextData.stock;

  if (Array.isArray(nextData.variations)) {
    nextData.variations = nextData.variations.map((variation) => ({
      ...variation,
      stock: 0
    }));
  }

  return nextData;
};

const hasSameSelectedOptions = (variation, orderItem) => {
  const variationOptions = mapToPlainObject(variation.optionValues);
  const orderOptions = mapToPlainObject(orderItem.selectedOptions);
  const variationKeys = Object.keys(variationOptions || {});
  const orderKeys = Object.keys(orderOptions || {});

  if (variationKeys.length === 0 || variationKeys.length !== orderKeys.length) {
    return false;
  }

  return variationKeys.every((key) => String(variationOptions[key] || '') === String(orderOptions[key] || ''));
};

const findMatchingVariation = (product, orderItem) => {
  if (!product.hasVariations || !Array.isArray(product.variations)) {
    return null;
  }

  if (orderItem.variationId) {
    const variationById = product.variations.id(orderItem.variationId);
    if (variationById) return variationById;
  }

  return product.variations.find((variation) =>
    hasSameSelectedOptions(variation, orderItem) ||
    (orderItem.variationName && variation.name === orderItem.variationName)
  ) || null;
};

const getCurrentPriceForOrderItem = (product, orderItem) => {
  if (!product.hasVariations) {
    return Number(product.price || 0);
  }

  const variation = findMatchingVariation(product, orderItem);
  return variation ? Number(variation.price || 0) : null;
};

const syncUnpaidOrderPricesForProduct = async (product) => {
  const orders = await EcommerceOrder.find({
    paymentStatus: { $ne: 'paid' },
    'items.productId': product._id.toString()
  });

  let updatedOrdersCount = 0;

  for (const order of orders) {
    let orderChanged = false;

    order.items.forEach((item) => {
      if (item.productId !== product._id.toString()) {
        return;
      }

      const currentPrice = getCurrentPriceForOrderItem(product, item);
      if (currentPrice === null || Number(item.price || 0) === currentPrice) {
        return;
      }

      item.price = currentPrice;
      item.subtotal = currentPrice * Number(item.quantity || 1);
      orderChanged = true;
    });

    if (!orderChanged) {
      continue;
    }

    const nextTotalAmount = order.items.reduce(
      (sum, item) => sum + Number(item.subtotal || 0),
      0
    );
    const totalPaid = Number(order.installmentPlan?.totalPaid || 0);
    const nextRemainingBalance = Math.max(0, nextTotalAmount - totalPaid);

    order.totalAmount = nextTotalAmount;

    if (order.installmentPlan) {
      order.installmentPlan.remainingBalance = nextRemainingBalance;
      order.installmentPlan.amountPerPeriod = 0;
      order.installmentPlan.duration = 0;
      order.installmentPlan.frequency = 'flexible';
      order.installmentPlan.nextPaymentDate = null;
    }

    if (nextRemainingBalance === 0) {
      order.paymentStatus = 'paid';
      order.status = 'paid';
    } else {
      order.paymentStatus = totalPaid > 0 ? 'partial' : 'unpaid';
      if (order.status === 'paid' || order.status === 'partially_paid') {
        order.status = totalPaid > 0 ? 'partially_paid' : 'pending';
      }
    }

    if (order.SBAccountNumber) {
      await SBAccount.findOneAndUpdate(
        { SBAccountNumber: order.SBAccountNumber },
        {
          $set: {
            sellingPrice: nextTotalAmount,
            status: nextRemainingBalance === 0 ? 'sold' : 'booked'
          }
        }
      );
    }

    await order.save();
    updatedOrdersCount += 1;
  }

  return updatedOrdersCount;
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
  productData = validateProductPricing(productData);
  productData = removeStockFields(productData);
  productData.stock = 0;
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
  return await applyBranchStockToProducts(products);
};

const getAllProductsAdmin = async () => {
  const products = await Product.find({}).sort({ createdAt: -1 });
  return await applyBranchStockToProducts(products);
};

const getProductById = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }
  return await applyBranchStockToProduct(product);
};

const getProductsByCategory = async (categoryId) => {
  const products = await Product.find({ categoryId, isActive: true }).sort({ createdAt: -1 });
  return await applyBranchStockToProducts(products);
};

const updateProduct = async (productId, updateData) => {
  updateData = normalizeProductData(updateData);
  const existingProduct = await Product.findById(productId);
  if (!existingProduct) {
    throw new Error('Product not found');
  }

  updateData = validateProductPricing(updateData, existingProduct);
  updateData = removeStockFields(updateData);
  if (updateData.categoryId || Object.prototype.hasOwnProperty.call(updateData, 'subCategoryId')) {
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
  await recalculateProductStock(productId);
  const syncedProduct = await Product.findById(productId);
  await syncUnpaidOrderPricesForProduct(syncedProduct);
  return await applyBranchStockToProduct(syncedProduct);
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

const updateProductStock = async (productId, quantity, operation = 'decrease', variationId = '', branchId = '', staffId = '') => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }
  if (!branchId) {
    throw new Error('Branch is required for product stock update');
  }

  if (variationId) {
    const variation = product.variations.id(variationId);
    if (!variation) {
      throw new Error('Product variation not found');
    }
  }

  const normalizedQuantity = normalizeNumber(quantity);
  const normalizedVariationId = variationId || '';
  const stockQuery = {
    productId: productId.toString(),
    branchId: branchId.toString(),
    variationId: normalizedVariationId
  };

  if (operation === 'decrease') {
    const updatedStock = await ProductBranchStock.findOneAndUpdate(
      {
        ...stockQuery,
        quantity: { $gte: normalizedQuantity }
      },
      {
        $inc: { quantity: -normalizedQuantity },
        $set: { updatedBy: staffId || '' }
      },
      { new: true }
    );

    if (!updatedStock) {
      const currentStock = await ProductBranchStock.findOne(stockQuery).lean();
      const availableQuantity = Number(currentStock?.quantity || 0);
      const variationLabel = normalizedVariationId ? ' for the selected variation' : '';
      throw new Error(
        `Insufficient branch stock${variationLabel}. Available: ${availableQuantity}, Required: ${normalizedQuantity}`
      );
    }

    return await recalculateProductStock(productId);
  }

  const existingStock = await ProductBranchStock.findOne(stockQuery);
  const currentQuantity = Number(existingStock?.quantity || 0);
  const nextQuantity = operation === 'set'
    ? normalizedQuantity
    : currentQuantity + normalizedQuantity;

  await ProductBranchStock.findOneAndUpdate(
    stockQuery,
    {
      $set: {
        quantity: nextQuantity,
        updatedBy: staffId || ''
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const updatedProduct = await recalculateProductStock(productId);
  return await applyBranchStockToProduct(updatedProduct);
};

const getFeaturedProducts = async (limit = 8) => {
  const products = await Product.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit);
  return await applyBranchStockToProducts(products);
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
