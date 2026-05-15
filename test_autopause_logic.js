const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://xlnxdzocwgrzqoznmarc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: rows, error } = await supabase
        .from('listings')
        .select('id, title, status, expires_at, updated_at, sale_type')
        .eq('status', 'active');

    if (error) {
        console.error(error);
        return;
    }

    const TOLERANCE_MS = 12 * 60 * 60 * 1000;
    const now = Date.now();

    const results = rows.map(r => {
        const expiresAt = r.expires_at ? Date.parse(r.expires_at) : NaN;
        const isAuction = r.sale_type === 'auction';
        const wouldPause = !isAuction && r.expires_at && (expiresAt + TOLERANCE_MS) < now;

        return {
            id: r.id,
            title: r.title,
            expires_at: r.expires_at,
            updated_at: r.updated_at,
            wouldPause
        };
    });

    const toPause = results.filter(r => r.wouldPause);
    console.log(JSON.stringify({
        serverNow: new Date(now).toISOString(),
        totalActive: rows.length,
        toPauseCount: toPause.length,
        toPauseData: toPause,
        top5NearExpiration: results.sort((a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at)).slice(0, 5)
    }, null, 2));
}

test();
