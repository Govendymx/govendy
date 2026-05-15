
require('dotenv').config({ path: '.env.local' });
const Replicate = require('replicate');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function getVersion() {
  try {
    console.log("Getting model info...");
    const model = await replicate.models.get("black-forest-labs", "flux-schnell");
    console.log("Latest version:", model.latest_version.id);
  } catch (e) {
    console.error(e);
  }
}

getVersion();
