import { getT1Quotes } from '../lib/shipping/t1-api';

async function run() {
  try {
    const quotes = await getT1Quotes({
        origin_zip: "02940",
        dest_zip: "91180",
        weight_kg: 1,
        length_cm: 20,
        width_cm: 20,
        height_cm: 30,
        seller_plan: "basic"
    });
    console.log("QUOTES:", JSON.stringify(quotes, null, 2));
  } catch (err) {
    console.error("ERROR:", err);
  }
}
run();
