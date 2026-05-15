
const Replicate = require("replicate");

const token = process.env.REPLICATE_API_TOKEN || "YOUR_TOKEN_HERE";
const replicate = new Replicate({
  auth: token,
});

async function test() {
  console.log("Testing Replicate Token...");
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
        console.warn("WARNING: No REPLICATE_API_TOKEN found in environment. Test might fail if not set.");
    }
    const output = await replicate.run(
      "meta/meta-llama-3-70b-instruct",
      {
        input: {
          prompt: "Hello, are you working?",
          max_tokens: 10
        }
      }
    );
    console.log("Success:", output);
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
