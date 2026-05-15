
require('dotenv').config({ path: '.env.local' });
const cloudinary = require('cloudinary').v2;

// Testing MediaFlows credentials
const cloudName = 'daply70pk';
const apiKey = '227397636739576';
const apiSecret = 'CleMApo1M6fd2vf6PMWtPsqJo';

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

console.log('Testing Cloudinary Connection (MediaFlows)...');
console.log('Cloud Name:', cloudName);
console.log('API Key:', apiKey);

cloudinary.uploader.upload('https://res.cloudinary.com/demo/image/upload/sample.jpg', {
  folder: 'test-upload',
}, (error, result) => {
  if (error) {
    console.error('❌ Upload Failed:', error);
  } else {
    console.log('✅ Upload Success:', result.secure_url);
  }
});
