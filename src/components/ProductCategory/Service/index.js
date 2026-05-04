const ProductCategory = require('../Model/index');

const normalizeSubcategories = (subcategories = []) => {
  const seen = new Set();

  return subcategories
    .map((subCategory) => {
      if (typeof subCategory === 'string') {
        return { name: subCategory.trim(), isActive: true };
      }

      return {
        _id: subCategory?._id,
        name: String(subCategory?.name || '').trim(),
        isActive: subCategory?.isActive !== false
      };
    })
    .filter((subCategory) => {
      if (!subCategory.name) {
        return false;
      }

      const key = subCategory.name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
};

const mapCategoryForStorefront = (category) => {
  const data = category.toObject ? category.toObject() : category;

  return {
    ...data,
    subcategories: (data.subcategories || []).filter(
      (subCategory) => subCategory.isActive !== false
    )
  };
};

const createCategory = async (categoryData) => {
  const existingCategory = await ProductCategory.findOne({ name: categoryData.name });
  if (existingCategory) {
    throw new Error('Category with this name already exists');
  }

  const category = new ProductCategory({
    ...categoryData,
    subcategories: normalizeSubcategories(categoryData.subcategories)
  });

  return await category.save();
};

const getAllCategories = async () => {
  const categories = await ProductCategory.find({ isActive: true }).sort({ name: 1 });
  return categories.map(mapCategoryForStorefront);
};

const getAllCategoriesAdmin = async () => {
  return await ProductCategory.find({}).sort({ createdAt: -1 });
};

const getCategoryById = async (categoryId) => {
  return await ProductCategory.findById(categoryId);
};

const updateCategory = async (categoryId, updateData) => {
  const payload = { ...updateData };

  if (Object.prototype.hasOwnProperty.call(payload, 'subcategories')) {
    payload.subcategories = normalizeSubcategories(payload.subcategories);
  }

  const category = await ProductCategory.findByIdAndUpdate(
    categoryId,
    { $set: payload },
    { new: true }
  );
  if (!category) {
    throw new Error('Category not found');
  }
  return category;
};

const deleteCategory = async (categoryId) => {
  const category = await ProductCategory.findByIdAndUpdate(
    categoryId,
    { $set: { isActive: false } },
    { new: true }
  );
  if (!category) {
    throw new Error('Category not found');
  }
  return { message: 'Category deleted successfully' };
};

const toggleCategoryStatus = async (categoryId) => {
  const category = await ProductCategory.findById(categoryId);
  if (!category) {
    throw new Error('Category not found');
  }

  category.isActive = !category.isActive;
  await category.save();

  return category;
};

module.exports = {
  createCategory,
  getAllCategories,
  getAllCategoriesAdmin,
  getCategoryById,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus
};
