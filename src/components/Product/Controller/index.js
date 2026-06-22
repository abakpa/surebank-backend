const ProductService = require('../Service/index');

const applyVariationImages = (variations, variationImages) => {
  if (!variationImages || Object.keys(variationImages).length === 0) {
    return variations;
  }

  let parsedVariations = variations;
  if (typeof parsedVariations === 'string') {
    try {
      parsedVariations = JSON.parse(parsedVariations);
    } catch (error) {
      return variations;
    }
  }

  if (!Array.isArray(parsedVariations)) {
    return variations;
  }

  const nextVariations = parsedVariations.map((variation, index) => ({
    ...variation,
    image: variationImages[index] || variation.image || ''
  }));

  return JSON.stringify(nextVariations);
};

const createProduct = async (req, res) => {
  try {
    const createdBy = req.staff.staffId;
    const {
      name,
      description,
      categoryId,
      subCategoryId,
      costPrice,
      price,
      profit,
      images,
      hasVariations,
      variationOptions,
      variations,
      sku,
      isActive,
      allowInstallment,
      minInstallmentAmount,
      branchId,
      variationImages
    } = req.body;
    const nextVariations = applyVariationImages(variations, variationImages);

    const product = await ProductService.createProduct({
      name,
      description,
      categoryId,
      subCategoryId,
      costPrice: costPrice || 0,
      price,
      profit: profit || 0,
      images,
      hasVariations,
      variationOptions,
      variations: nextVariations,
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
    const { categoryId, subCategoryId, minPrice, maxPrice, search } = req.query;
    const products = await ProductService.getAllProducts({
      categoryId,
      subCategoryId,
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
    const updateData = { ...req.body };
    if (req.body.variations !== undefined || req.body.variationImages !== undefined) {
      updateData.variations = applyVariationImages(req.body.variations, req.body.variationImages);
    }
    delete updateData.variationImages;

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
    const { quantity, operation, variationId } = req.body;
    const branchId = req.staff.branchId;

    const product = await ProductService.updateProductStock(
      productId,
      quantity,
      operation || 'set',
      variationId || '',
      branchId,
      req.staff.staffId
    );

    res.status(200).json({
      message: 'Branch stock updated successfully',
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
