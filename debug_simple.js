const { createClient } = require('@supabase/supabase-js');
// Simple env loader to avoid dotenv if it was causing issues
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envMap = {};
env.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) envMap[k.trim()] = v.trim();
});

async function debug() {
    const supabase = createClient(
        envMap.SUPABASE_URL || envMap.NEXT_PUBLIC_SUPABASE_URL,
        envMap.SUPABASE_SERVICE_ROLE_KEY || envMap.SUPABASE_SERVICE_KEY
    );

    const publicId = 'PCK-C30799A89C';
    console.log(`Searching for Public ID: ${publicId}`);

    const { data: listings, error } = await supabase
        .from('listings')
        .select('*')
        .eq('public_id', publicId);

    if (error) {
        console.error('Fetch Error:', error);
        return;
    }

    if (listings.length === 0) {
        console.log('No listing found with that public_id.');
        return;
    }

    console.log('Listing Record (RAW):');
    console.log(listings[0]);
}

debug();
