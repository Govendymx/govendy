
const cloudinary = require('cloudinary').v2;

// Testing MediaFlows key with "Dr" prefix
const correctSecret = 'DrCleMApo1M6fd2vf6PMWtPsqJo';

const config = {
  cloud_name: 'daply70pk',
  api_key: '227397636739576',
  api_secret: correctSecret
};

console.log('Testing MediaFlows key with "Dr" prefix...');
console.log('API Key:', config.api_key);
cloudinary.config(config);

cloudinary.uploader.upload('https://res.cloudinary.com/demo/image/upload/sample.jpg', {
  folder: 'test-upload-fix-2'
}, (error, result) => {
  if (error) {
    console.error('❌ Upload Failed:', error);
  } else {
    console.log('✅ Upload Success:', result.secure_url);
  }
});
