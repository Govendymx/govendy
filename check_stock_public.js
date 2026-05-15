const { createClient } = require('@supabase/supabase-js');

async function run() {
    const url = "https://xlnxdzocwgrzqoznmarc.supabase.co";
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3ODIzNjcsImV4cCI6MjA4NDM1ODM2N30.QUlvSqTyrF3xSsDvuU95WT0_t3DU8vaG-cQG2l1yAdg";

    const supabase = createClient(url, key);
    const publicId = 'PCK-C30799A89C';

    console.log('Checking listing:', publicId);
    const { data: listing, error } = await supabase
        .from('listings')
        .select('id, public_id, title, status, stock, size_stock, expires_at')
        .eq('public_id', publicId)
        .single();

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('--- LISTING DATA ---');
    console.log('ID:', listing.id);
    console.log('Status:', listing.status);
    console.log('Stock:', listing.stock);
    console.log('Size Stock:', JSON.stringify(listing.size_stock));
    console.log('Expires At:', listing.expires_at);

    if (listing.stock === 0 || (listing.size_stock && Object.values(listing.size_stock).reduce((a, b) => a + (Number(b) || 0), 0) === 0)) {
        console.log('WARNING: Stock is zero. This might triggered the autopause trigger if installed.');
    }
}

run();
