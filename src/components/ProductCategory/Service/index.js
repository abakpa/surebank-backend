const ProductCategory = require('../Model/index');

const createCategory = async (categoryData) => {
  const existingCategory = await ProductCategory.findOne({ name: categoryData.name });
  if (existingCategory) {
    throw new Error('Category with this name already exists');
  }
  const category = new ProductCategory(categoryData);
  return await category.save();
};

const getAllCategories = async () => {
  return await ProductCategory.find({ isActive: true }).sort({ name: 1 });
};

const getAllCategoriesAdmin = async () => {
  return await ProductCategory.find({}).sort({ createdAt: -1 });
};

const getCategoryById = async (categoryId) => {
  return await ProductCategory.findById(categoryId);
};

const updateCategory = async (categoryId, updateData) => {
  const category = await ProductCategory.findByIdAndUpdate(
    categoryId,
    { $set: updateData },
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
