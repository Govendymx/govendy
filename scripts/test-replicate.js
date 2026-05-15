
require('dotenv').config({ path: '.env.local' });
const Replicate = require('replicate');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function test() {
  try {
    console.log("Testing Replicate...");
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: "Test banner",
          aspect_ratio: "21:9",
          output_format: "webp",
          output_quality: 90,
          disable_safety_checker: false
        }
      }
    );
    
    console.log("Output type:", typeof output);
    console.log("Is Array:", Array.isArray(output));
    if (Array.isArray(output)) {
        console.log("Element 0 type:", typeof output[0]);
        console.log("Element 0:", output[0]);
        
        // Check if it is a stream
        if (output[0] && typeof output[0].read === 'function') {
            console.log("Element 0 is a Stream");
        }
    } else {
        console.log("Output:", output);
    }
    
  } catch (e) {
    console.error(e);
  }
}

test();
