
const cloudinary = require('cloudinary').v2;

const combos = [
  {
    name: 'Combo 1: Cloud daply + Key 227 + Secret Cle (Original)',
    config: {
      cloud_name: 'daply70pk',
      api_key: '227397636739576',
      api_secret: 'CleMApo1M6fd2vf6PMWtPsqJo'
    }
  },
  {
    name: 'Combo 2: Cloud daply + Key 227 + Secret U53 (Mix)',
    config: {
      cloud_name: 'daply70pk',
      api_key: '227397636739576',
      api_secret: 'U53uLrn9CyeSbZwUQzgJkhc-s'
    }
  },
  {
    name: 'Combo 3: Cloud daply + Key 917 + Secret U53 (Root)',
    config: {
      cloud_name: 'daply70pk',
      api_key: '91785158482851',
      api_secret: 'U53uLrn9CyeSbZwUQzgJkhc-s'
    }
  },
  {
    name: 'Combo 4: Cloud daply + Key 917 + Secret Cle (Mix)',
    config: {
      cloud_name: 'daply70pk',
      api_key: '91785158482851',
      api_secret: 'CleMApo1M6fd2vf6PMWtPsqJo'
    }
  }
];

async function testCombo(combo) {
  console.log(`\nTesting ${combo.name}...`);
  cloudinary.config(combo.config);
  try {
    const result = await cloudinary.uploader.upload('https://res.cloudinary.com/demo/image/upload/sample.jpg', {
      folder: 'test-upload-debug'
    });
    console.log(`✅ SUCCESS! ${combo.name} works.`);
    return true;
  } catch (error) {
    console.log(`❌ FAILED ${combo.name}: ${error.message}`);
    return false;
  }
}

async function run() {
  for (const combo of combos) {
    if (await testCombo(combo)) break;
  }
}

run();
