require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../src/components/Product/Model');
const ProductCategory = require('../src/components/ProductCategory/Model');
const { uploadImageBuffer } = require('../src/utils/cloudinary');
const { isAbsoluteUrl } = require('../src/utils/image');

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

const buildFileFromLocalPath = (imagePath) => {
  const normalizedPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  const absolutePath = path.join(__dirname, '..', normalizedPath);
  const extension = path.extname(absolutePath).toLowerCase();

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Local image not found: ${absolutePath}`);
  }

  return {
    originalname: path.basename(absolutePath),
    mimetype: mimeTypes[extension] || 'application/octet-stream',
    buffer: fs.readFileSync(absolutePath)
  };
};

const migrateProducts = async () => {
  const products = await Product.find({
    images: {
      $elemMatch: {
        $regex: '^/uploads/'
      }
    }
  });

  for (const product of products) {
    const nextImages = [];
    let changed = false;

    for (const image of product.images || []) {
      if (isAbsoluteUrl(image)) {
        nextImages.push(image);
        continue;
      }

      const uploadedUrl = await uploadImageBuffer(
        buildFileFromLocalPath(image),
        'surebank/products'
      );

      nextImages.push(uploadedUrl);
      changed = true;
    }

    if (changed) {
      product.images = nextImages;
      await product.save();
      console.log(`Migrated product ${product._id}`);
    }
  }
};

const migrateCategories = async () => {
  const categories = await ProductCategory.find({
    image: {
      $regex: '^/uploads/'
    }
  });

  for (const category of categories) {
    if (!category.image || isAbsoluteUrl(category.image)) {
      continue;
    }

    const uploadedUrl = await uploadImageBuffer(
      buildFileFromLocalPath(category.image),
      'surebank/categories'
    );

    category.image = uploadedUrl;
    await category.save();
    console.log(`Migrated category ${category._id}`);
  }
};

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is required');
    }

    await mongoose.connect(process.env.MONGO_URI);
    await migrateProducts();
    await migrateCategories();
    console.log('Image migration completed');
  } catch (error) {
    console.error('Image migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
