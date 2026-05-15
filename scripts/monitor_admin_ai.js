
const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ENDPOINT = '/api/admin/chat';
const THRESHOLD_LATENCY_MS = 5000;
const THRESHOLD_ERROR_RATE = 0.01; // 1%

// Test Payload
const PAYLOAD = JSON.stringify({
  message: "Status check: How many orders today?"
});

async function checkHealth() {
  console.log(`[Monitor] Checking ${BASE_URL}${ENDPOINT}...`);
  
  const startTime = Date.now();
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': PAYLOAD.length,
    },
    timeout: 30000 // 30s hard timeout
  };

  const lib = BASE_URL.startsWith('https') ? https : http;
  const url = new URL(BASE_URL + ENDPOINT);

  const req = lib.request(url, options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      const duration = Date.now() - startTime;
      const status = res.statusCode;
      
      console.log(`[Monitor] Status: ${status}`);
      console.log(`[Monitor] Latency: ${duration}ms`);

      // Analysis
      if (status >= 500) {
        console.error(`[ALERT] API Error: Status ${status}`);
        console.error(`[Response] ${data}`);
        process.exit(1);
      }

      if (duration > THRESHOLD_LATENCY_MS) {
        console.error(`[ALERT] High Latency: ${duration}ms (Threshold: ${THRESHOLD_LATENCY_MS}ms)`);
        process.exit(1);
      }

      try {
        const json = JSON.parse(data);
        if (json.error) {
            console.error(`[ALERT] Application Error: ${json.error}`);
            process.exit(1);
        }
        console.log(`[Success] AI Reply received: "${json.reply?.substring(0, 50)}..."`);
      } catch (e) {
        console.error(`[ALERT] Invalid JSON response`);
        process.exit(1);
      }
      
      process.exit(0);
    });
  });

  req.on('error', (e) => {
    console.error(`[Monitor] Network Error: ${e.message}`);
    process.exit(1);
  });

  req.on('timeout', () => {
      req.destroy();
      console.error(`[Monitor] Timeout (>30s)`);
      process.exit(1);
  });

  req.write(PAYLOAD);
  req.end();
}

checkHealth();
