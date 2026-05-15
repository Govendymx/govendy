const https = require('https');

const BASE_URL = 'https://www.gopocket.com.mx';
const ENDPOINT = '/api/chat/user';
const CONCURRENT_REQUESTS = 5;
const TOTAL_REQUESTS = 10;

console.log(`🚀 Starting Stress Test for AI Chat`);
console.log(`Target: ${BASE_URL}${ENDPOINT}`);
console.log(`Concurrency: ${CONCURRENT_REQUESTS}`);
console.log(`Total Requests: ${TOTAL_REQUESTS}`);
console.log('-----------------------------------');

let completed = 0;
let successes = 0;
let failures = 0;
let totalTime = 0;

function makeRequest(id) {
  return new Promise((resolve) => {
    const start = Date.now();
    const data = JSON.stringify({ message: "Hola, ¿qué puedes hacer?" });

    const options = {
      hostname: 'www.gopocket.com.mx',
      path: '/api/chat/user',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        totalTime += duration;
        
        if (res.statusCode === 200) {
          successes++;
          console.log(`✅ Request #${id}: Success (${duration}ms)`);
        } else {
          failures++;
          console.log(`❌ Request #${id}: Failed (${res.statusCode}) - ${duration}ms`);
          console.log(`   Error: ${body.substring(0, 100)}...`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      const duration = Date.now() - start;
      failures++;
      console.log(`❌ Request #${id}: Network Error (${e.message}) - ${duration}ms`);
      resolve();
    });

    req.write(data);
    req.end();
  });
}

async function runTest() {
  const batches = Math.ceil(TOTAL_REQUESTS / CONCURRENT_REQUESTS);
  
  for (let i = 0; i < batches; i++) {
    const batchPromises = [];
    for (let j = 0; j < CONCURRENT_REQUESTS; j++) {
      const reqId = i * CONCURRENT_REQUESTS + j + 1;
      if (reqId <= TOTAL_REQUESTS) {
        batchPromises.push(makeRequest(reqId));
      }
    }
    await Promise.all(batchPromises);
  }

  console.log('-----------------------------------');
  console.log(`📊 Test Results:`);
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`Successes: ${successes}`);
  console.log(`Failures: ${failures}`);
  console.log(`Avg Response Time: ${(totalTime / TOTAL_REQUESTS).toFixed(0)}ms`);
  
  if (failures > 0) {
    console.log('⚠️  Issues detected! Check logs above.');
  } else {
    console.log('✨ System appears stable.');
  }
}

runTest();
