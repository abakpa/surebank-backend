const ProductCategoryService = require('../Service/index');

const createCategory = async (req, res) => {
  try {
    const createdBy = req.staff.staffId;
    const { name, description, image } = req.body;

    const category = await ProductCategoryService.createCategory({
      name,
      description,
      image,
      createdBy
    });

    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllCategories = async (req, res) => {
  try {
    const categories = await ProductCategoryService.getAllCategories();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllCategoriesAdmin = async (req, res) => {
  try {
    const categories = await ProductCategoryService.getAllCategoriesAdmin();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const category = await ProductCategoryService.getCategoryById(categoryId);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const updateData = req.body;

    const category = await ProductCategoryService.updateCategory(categoryId, updateData);

    res.status(200).json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const result = await ProductCategoryService.deleteCategory(categoryId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const toggleCategoryStatus = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const category = await ProductCategoryService.toggleCategoryStatus(categoryId);

    res.status(200).json({
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      category
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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
