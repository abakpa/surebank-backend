const axios = require('axios');
const crypto = require('crypto');

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'surebank';

const hasCloudinaryConfig = () =>
  Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);

const buildSignature = (params) => {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHash('sha1')
    .update(`${serialized}${CLOUDINARY_API_SECRET}`)
    .digest('hex');
};

const uploadImageBuffer = async (file, folder = `${CLOUDINARY_FOLDER}/products`) => {
  if (!hasCloudinaryConfig()) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    folder,
    timestamp
  };

  const signature = buildSignature(payload);
  const fileAsDataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  const body = new URLSearchParams({
    file: fileAsDataUri,
    api_key: CLOUDINARY_API_KEY,
    timestamp: String(timestamp),
    folder,
    signature
  });

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      body.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data.secure_url;
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message || 'Cloudinary upload failed';
    throw new Error(message);
  }
};

module.exports = {
  hasCloudinaryConfig,
  uploadImageBuffer
};
