import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read from .env.production.local (as deployed)
const envContent = readFileSync('.env.production.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.substring(0, i).trim()] = t.substring(i + 1).trim();
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', JSON.stringify(url));
console.log('URL length:', url?.length);
console.log('URL bytes:', url ? [...url].map(c => c.charCodeAt(0)).join(',') : 'N/A');
console.log('KEY length:', key?.length);
console.log('KEY first 20:', key?.substring(0, 20));
console.log('KEY last 10:', key?.substring(key.length - 10));

// Check for hidden characters
const hasHidden = (s) => {
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c < 32 || c > 126) return `Found char ${c} at position ${i}`;
    }
    return 'clean';
};
console.log('\nURL chars:', hasHidden(url));
console.log('KEY chars:', hasHidden(key));

// Test auth endpoint directly
console.log('\n--- Testing auth endpoint ---');
const supabase = createClient(url, key);

try {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test-nonexistent@test.com',
        password: 'testpassword123',
    });
    console.log('Auth response error:', error?.message || 'none');
    console.log('Auth response status:', error?.status || 'N/A');
    // We expect "Invalid login credentials" - that means auth endpoint works
} catch (e) {
    console.log('Auth EXCEPTION:', e.message);
}

// Test a simple fetch to the auth endpoint
console.log('\n--- Direct fetch to auth endpoint ---');
try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': key,
        },
        body: JSON.stringify({ email: 'test@test.com', password: 'test' }),
    });
    console.log('Status:', res.status);
    const body = await res.text();
    console.log('Body:', body.substring(0, 200));
} catch (e) {
    console.log('Fetch EXCEPTION:', e.message);
}

process.exit(0);
