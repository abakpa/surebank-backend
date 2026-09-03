require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('../src/components/Product/Model');

const shouldWrite = process.env.RUN_UPLOAD_IMAGE_CLEANUP === 'true';
const isUploadPath = (value = '') => String(value || '').startsWith('/uploads/');

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is required in backend/.env');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const products = await Product.find({
      $or: [
        { images: { $elemMatch: { $regex: '^/uploads/' } } },
        { 'variations.image': { $regex: '^/uploads/' } }
      ]
    });

    let removedProductImages = 0;
    let removedVariationImages = 0;

    for (const product of products) {
      const currentImages = Array.isArray(product.images) ? product.images : [];
      const nextImages = currentImages.filter((image) => !isUploadPath(image));
      const removedImages = currentImages.length - nextImages.length;

      let removedVariations = 0;
      if (Array.isArray(product.variations)) {
        product.variations.forEach((variation) => {
          if (isUploadPath(variation.image)) {
            removedVariations += 1;
            if (shouldWrite) {
              variation.image = '';
            }
          }
        });
      }

      removedProductImages += removedImages;
      removedVariationImages += removedVariations;

      console.log(
        `${shouldWrite ? 'Updated' : 'Would update'} ${product._id} "${product.name}": ` +
        `${removedImages} product image(s), ${removedVariations} variation image(s)`
      );

      if (shouldWrite) {
        product.images = nextImages;
        await product.save();
      }
    }

    console.log(
      `${shouldWrite ? 'Removed' : 'Would remove'} ${removedProductImages} product image reference(s) ` +
      `and ${removedVariationImages} variation image reference(s) from ${products.length} product(s).`
    );

    if (!shouldWrite) {
      console.log('Dry run only. Set RUN_UPLOAD_IMAGE_CLEANUP=true to apply changes.');
    }
  } catch (error) {
    console.error('Upload image reference cleanup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
