const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkSchema() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    console.log('--- CHECKING COLUMNS FOR listings ---');
    const { data: listingsSample, error: listingsError } = await supabase
        .from('listings')
        .select('*')
        .limit(1);

    if (listingsError) {
        console.error('Listings Fetch Error:', listingsError);
    } else if (listingsSample && listingsSample[0]) {
        console.log('Listings Columns:', Object.keys(listingsSample[0]).join(', '));
    } else {
        console.log('No listings found to check columns.');
    }

    console.log('\n--- CHECKING COLUMNS FOR profiles ---');
    const { data: profilesSample, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (profilesError) {
        console.error('Profiles Fetch Error:', profilesError);
    } else if (profilesSample && profilesSample[0]) {
        console.log('Profiles Columns:', Object.keys(profilesSample[0]).join(', '));
    } else {
        console.log('No profiles found to check columns.');
    }
}

checkSchema();
