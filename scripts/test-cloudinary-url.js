
const cloudinary = require('cloudinary').v2;

// Construct URL from Root credentials
const cloudName = 'daply70pk';
const apiKey = '91785158482851';
const apiSecret = 'U53uLrn9CyeSbZwUQzgJkhc-s';

const cloudinaryUrl = `cloudinary://${apiKey}:${apiSecret}@${cloudName}`;

console.log('Testing with CLOUDINARY_URL...');
// Set via environment variable logic simulation
process.env.CLOUDINARY_URL = cloudinaryUrl;

// Reset config
cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret
});

cloudinary.uploader.upload('https://res.cloudinary.com/demo/image/upload/sample.jpg', {
  folder: 'test-upload-url'
}, (error, result) => {
  if (error) {
    console.error('❌ Upload Failed:', error);
  } else {
    console.log('✅ Upload Success:', result.secure_url);
  }
});
