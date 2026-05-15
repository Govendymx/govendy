
require('dotenv').config({ path: '.env.local' });
const Replicate = require('replicate');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function test() {
  try {
    console.log("Testing Replicate Prediction API...");
    
    // Create prediction
    const prediction = await replicate.predictions.create({
      version: "f2d31c8135231737f59d4310d7a9645c117d91361998590c5f357b9820f1712a", // Flux Schnell version hash? Or use model name if supported
      // Usually better to use model identifier if SDK supports it in create?
      // SDK `predictions.create` expects `version` or `model`?
      // Replicate docs say: "model" parameter is supported in recent SDKs.
      model: "black-forest-labs/flux-schnell",
      input: {
        prompt: "Test banner",
        aspect_ratio: "21:9",
        output_format: "webp"
      }
    });
    
    console.log("Prediction created:", prediction.id);
    
    const final = await replicate.wait(prediction);
    console.log("Final status:", final.status);
    console.log("Final output:", final.output);
    console.log("Final output type:", typeof final.output);
    if (Array.isArray(final.output)) {
        console.log("Element 0:", final.output[0]);
    }
    
  } catch (e) {
    console.error(e);
  }
}

test();
