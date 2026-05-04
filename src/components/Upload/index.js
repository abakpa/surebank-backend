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

// Handle upload for product images
const uploadProductImages = (req, res, next) => {
  uploadMultiple(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ message: 'Too many files. Maximum is 5 images.' });
      }
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    // Add image URLs to request body
    if (req.files && req.files.length > 0) {
      try {
        req.body.images = await Promise.all(
          req.files.map((file) => uploadImageBuffer(file, 'surebank/products'))
        );
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
  deleteImage
};
