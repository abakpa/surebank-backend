const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadImageBuffer } = require('../../utils/cloudinary');
const { isAbsoluteUrl } = require('../../utils/image');

const uploadDir = path.join(__dirname, '../../../uploads/products');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Create multer instance
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Upload middleware for single file
const uploadSingle = upload.single('image');

// Upload middleware for multiple files
const uploadMultiple = upload.array('images', 5); // Max 5 images
const uploadProductFileFields = upload.any();

// Handle upload for product images
const uploadProductImages = (req, res, next) => {
  uploadProductFileFields(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
      }
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    const productImages = (req.files || []).filter((file) => file.fieldname === 'images');
    const variationImages = (req.files || []).filter((file) => /^variationImage_\d+$/.test(file.fieldname));

    if (productImages.length > 5) {
      return res.status(400).json({ message: 'Too many product images. Maximum is 5 images.' });
    }

    // Add image URLs to request body
    if (productImages.length > 0 || variationImages.length > 0) {
      try {
        if (productImages.length > 0) {
          req.body.images = await Promise.all(
            productImages.map((file) => uploadImageBuffer(file, 'surebank/products'))
          );
        }

        if (variationImages.length > 0) {
          const uploadedVariationImages = {};
          await Promise.all(
            variationImages.map(async (file) => {
              const index = file.fieldname.replace('variationImage_', '');
              uploadedVariationImages[index] = await uploadImageBuffer(file, 'surebank/products/variations');
            })
          );
          req.body.variationImages = uploadedVariationImages;
        }
      } catch (uploadError) {
        return res.status(500).json({ message: uploadError.message });
      }
    }

    next();
  });
};

// Handle upload for category image
const uploadCategoryImage = (req, res, next) => {
  uploadSingle(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
      }
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    // Add image URL to request body
    if (req.file) {
      try {
        req.body.image = await uploadImageBuffer(req.file, 'surebank/categories');
      } catch (uploadError) {
        return res.status(500).json({ message: uploadError.message });
      }
    }

    next();
  });
};

const uploadStaffSignature = (req, res, next) => {
  uploadSingle(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
      }
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Signature image is required.' });
    }

    try {
      req.body.signatureUrl = await uploadImageBuffer(req.file, 'surebank/staff-signatures');
      next();
    } catch (uploadError) {
      return res.status(500).json({ message: uploadError.message });
    }
  });
};

// Delete image file
const deleteImage = (imagePath) => {
  if (isAbsoluteUrl(imagePath)) {
    return false;
  }

  const fullPath = path.join(__dirname, '../../../', imagePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    return true;
  }
  return false;
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadProductImages,
  uploadCategoryImage,
  uploadStaffSignature,
  deleteImage
};
