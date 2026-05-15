const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xlnxdzocwgrzqoznmarc.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY'
);

async function main() {
    // Check existing policies on storage.objects
    const { data: policies, error: polErr } = await supabase
        .from('pg_policies') // won't work, need raw SQL
        .select('*');

    // Use the Management API directly via fetch
    const url = 'https://xlnxdzocwgrzqoznmarc.supabase.co/rest/v1/rpc/';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY';

    // Try to create policies via the SQL editor endpoint
    const sqlStatements = [
        `CREATE POLICY IF NOT EXISTS "delivery_proofs_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'delivery-proofs')`,
        `CREATE POLICY IF NOT EXISTS "delivery_proofs_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'delivery-proofs')`,
        `CREATE POLICY IF NOT EXISTS "delivery_proofs_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'delivery-proofs')`,
    ];

    // Use direct PostgreSQL connection via Supabase Management API
    for (const sql of sqlStatements) {
        console.log('Executing:', sql.substring(0, 80) + '...');
        try {
            const resp = await fetch(`https://xlnxdzocwgrzqoznmarc.supabase.co/pg/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`,
                    'apikey': key,
                },
                body: JSON.stringify({ query: sql }),
            });
            const text = await resp.text();
            console.log('Status:', resp.status, text.substring(0, 200));
        } catch (e) {
            console.error('Error:', e.message);
        }
    }

    // Alternative: try uploading a test file to see if it works
    const testContent = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const { data: upData, error: upError } = await supabase.storage
        .from('delivery-proofs')
        .upload('test_policy_check.txt', testContent, {
            contentType: 'text/plain',
            upsert: true,
        });

    if (upError) {
        console.log('Upload test with service role FAILED:', upError.message);
    } else {
        console.log('Upload test with service role OK:', upData);
        // Clean up
        await supabase.storage.from('delivery-proofs').remove(['test_policy_check.txt']);
    }
}

main().catch(console.error);
