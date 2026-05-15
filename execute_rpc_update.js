const fs = require('fs');
const path = require('path');

// Hardcoded keys from RESPALDO_CLAVES.env to ensure it works
const SUPABASE_URL = "https://xlnxdzocwgrzqoznmarc.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY";

async function run() {
  const sqlPath = path.join(__dirname, 'update_decrement_stock_rpc.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('Executing SQL...');
  
  const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = await response.json();
    console.log('Success:', result);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
