
const cloudinary = require('cloudinary').v2;

// Deducted from screenshot (prefix "i8") + user text ("U53...")
const correctSecret = 'i8U53uLrn9CyeSbZwUQzgJkhc-s';

const config = {
  cloud_name: 'daply70pk',
  api_key: '91785158482851',
  api_secret: correctSecret
};

console.log('Testing with corrected secret (added "i8" prefix)...');
console.log('API Key:', config.api_key);
console.log('API Secret (first 5 chars):', config.api_secret.substring(0, 5));

cloudinary.config(config);

cloudinary.uploader.upload('https://res.cloudinary.com/demo/image/upload/sample.jpg', {
  folder: 'test-upload-fix'
}, (error, result) => {
  if (error) {
    console.error('❌ Upload Failed:', error);
  } else {
    console.log('✅ Upload Success:', result.secure_url);
  }
});
