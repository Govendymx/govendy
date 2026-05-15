const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const rawBaseUrl = process.env.SMOKE_BASE_URL || process.env.BASE_URL || 'https://www.gopocket.com.mx';
const baseUrl = rawBaseUrl.startsWith('http') ? rawBaseUrl.replace(/\/$/, '') : `https://${rawBaseUrl.replace(/\/$/, '')}`;
const adminToken = (process.env.ADMIN_BEARER_TOKEN || '').trim();
const cronSecret = (process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || '').trim();
const runAi = String(process.env.SMOKE_RUN_AI || '').trim() === '1';
const runAdminHealth = String(process.env.SMOKE_RUN_ADMIN_HEALTH || '').trim() === '1' || Boolean(adminToken);
const runCron = String(process.env.SMOKE_RUN_CRON || '').trim() === '1' && Boolean(cronSecret);
const timeoutMs = Math.max(2000, Number(process.env.SMOKE_TIMEOUT_MS || 12000));

function buildHeaders(extra = {}) {
  return {
    'User-Agent': 'Pocket-Smoke-Tests/1.0',
    ...extra,
  };
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function runTest(test) {
  if (test.enabled === false) {
    return { name: test.name, status: 'skipped', reason: test.skipReason || 'omitido' };
  }

  const url = `${baseUrl}${test.path}`;
  const options = {
    method: test.method || 'GET',
    headers: buildHeaders(test.headers || {}),
  };

  if (test.body !== undefined) {
    const body = typeof test.body === 'string' ? test.body : JSON.stringify(test.body);
    options.body = body;
    if (!options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }
  }

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(url, options);
    const elapsed = Date.now() - start;
    const text = await res.text();
    let json = null;
    if (test.expectJson !== false) {
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        return { name: test.name, status: 'fail', error: 'JSON inválido', elapsed, statusCode: res.status };
      }
    }

    if (!res.ok) {
      return {
        name: test.name,
        status: 'fail',
        error: json?.error || text || `HTTP ${res.status}`,
        elapsed,
        statusCode: res.status,
      };
    }

    if (typeof test.validate === 'function') {
      const validation = test.validate({ res, json, text });
      if (validation !== true) {
        return {
          name: test.name,
          status: 'fail',
          error: typeof validation === 'string' ? validation : 'Validación fallida',
          elapsed,
          statusCode: res.status,
        };
      }
    }

    return { name: test.name, status: 'pass', elapsed, statusCode: res.status };
  } catch (e) {
    const elapsed = Date.now() - start;
    return { name: test.name, status: 'fail', error: e?.message || 'Error de red', elapsed };
  }
}

async function run() {
  const tests = [
    {
      name: 'Home',
      path: '/',
      method: 'GET',
      expectJson: false,
      validate: ({ res }) => (res.status >= 200 && res.status < 400) || 'HTTP inesperado',
    },
    {
      name: 'Postal Code',
      path: '/api/postal-code/lookup?cp=01000',
      method: 'GET',
      validate: ({ json }) => {
        if (!json || json.ok !== true) return json?.error || 'Respuesta inválida';
        if (!Array.isArray(json.colonias)) return 'Colonias inválidas';
        return true;
      },
    },
    {
      name: 'Admin Floating Messages',
      path: '/api/admin/floating-messages/list',
      method: 'GET',
      validate: ({ json }) => Array.isArray(json?.messages) || 'messages inválido',
    },
    {
      name: 'Admin Health',
      path: '/api/admin/health',
      method: 'GET',
      headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
      enabled: runAdminHealth,
      skipReason: 'ADMIN_BEARER_TOKEN no definido',
      validate: ({ json }) => json?.ok === true || json?.error || 'Respuesta inválida',
    },
    {
      name: 'Cron Jobs',
      path: cronSecret ? `/api/cron/jobs?secret=${encodeURIComponent(cronSecret)}` : '/api/cron/jobs',
      method: 'GET',
      enabled: runCron,
      skipReason: 'CRON_SECRET no definido o SMOKE_RUN_CRON != 1',
      validate: ({ json }) => json?.ok === true || json?.error || 'Respuesta inválida',
    },
    {
      name: 'AI Chat',
      path: '/api/chat',
      method: 'POST',
      body: { message: 'Smoke test' },
      enabled: runAi,
      skipReason: 'SMOKE_RUN_AI != 1',
      validate: ({ json }) => typeof json?.reply === 'string' || json?.error || 'Respuesta inválida',
    },
  ];

  console.log(`\nSmoke Tests → ${baseUrl}\n`);
  const results = [];
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
    if (result.status === 'pass') {
      console.log(`✅ ${result.name} (${result.statusCode}, ${result.elapsed}ms)`);
    } else if (result.status === 'skipped') {
      console.log(`⚪ ${result.name} (omitido: ${result.reason})`);
    } else {
      console.log(`❌ ${result.name} (${result.statusCode || 'ERR'}) ${result.error || ''}`.trim());
    }
  }

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  console.log(`\nResumen: ✅ ${passed} | ❌ ${failed} | ⚪ ${skipped}\n`);

  if (failed > 0) process.exit(1);
}

run();
