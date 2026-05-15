import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ipService } from '@/lib/security/ip-service';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { latitude, longitude } = body;

    // Get IP from request headers
    let ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    const userAgent = req.headers.get('user-agent') || undefined;

    const admin = supabaseAdmin();

    console.log(`📍 Location API called - User: ${user.id}, IP: ${ip}, Coords: ${latitude},${longitude}`);

    // CASE 1: No GPS coordinates (IP-based fallback)
    if (!latitude || !longitude || latitude === 0 || longitude === 0) {
      console.log('Using IP-based location (no GPS)');

      // Check if recently recorded
      const { data: recent } = await admin
        .from('user_ips')
        .select('id')
        .eq('user_id', user.id)
        .eq('ip_address', ip)
        .gt('detected_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1);

      if (recent && recent.length > 0) {
        console.log('IP already recorded recently, skipping');
        return NextResponse.json({ success: true, method: 'skipped_recent' });
      }

      // Try to get geo data (may fail, that's OK)
      let geoData = null;
      try {
        geoData = await ipService.getGeoLocation(ip);
        if (geoData) console.log('Geo data fetched:', geoData.city, geoData.country);
      } catch (e) {
        console.warn('Geo fetch failed:', e);
      }

      // ALWAYS insert, even without geo
      const { error } = await admin.from('user_ips').insert({
        user_id: user.id,
        ip_address: ip,
        is_approximate: true,
        user_agent: userAgent,
        detected_at: new Date().toISOString(),
        ...(geoData ? {
          country: geoData.country,
          city: geoData.city,
          region: geoData.region,
          latitude: geoData.lat,
          longitude: geoData.lon,
          isp: geoData.isp,
        } : {}),
        metadata: {
          source: 'ip_fallback',
          has_geo: !!geoData
        }
      });

      if (error) {
        console.error('Failed to insert IP record:', error);
        throw error;
      }

      console.log('✅ IP record inserted successfully');
      return NextResponse.json({ success: true, method: 'ip_fallback', has_geo: !!geoData });
    }

    // CASE 2: Precise GPS Location
    console.log('Using GPS location:', latitude, longitude);

    const { data: latestIp } = await admin
      .from('user_ips')
      .select('id, ip_address')
      .eq('user_id', user.id)
      .order('detected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Update or Insert
    if (latestIp && latestIp.ip_address === ip) {
      console.log('Updating existing IP record with GPS');
      const { error } = await admin
        .from('user_ips')
        .update({
          latitude,
          longitude,
          is_approximate: false,
          detected_at: new Date().toISOString(),
          metadata: {
            source: 'browser_geolocation',
            updated_at: new Date().toISOString()
          }
        })
        .eq('id', latestIp.id);

      if (error) throw error;
      console.log('✅ GPS record updated');
    } else {
      console.log('Creating new GPS record');
      const { error } = await admin
        .from('user_ips')
        .insert({
          user_id: user.id,
          ip_address: ip,
          latitude,
          longitude,
          is_approximate: false,
          user_agent: userAgent,
          detected_at: new Date().toISOString(),
          metadata: {
            source: 'browser_geolocation_new',
            created_at: new Date().toISOString()
          }
        });

      if (error) throw error;
      console.log('✅ GPS record inserted');
    }

    return NextResponse.json({ success: true, method: 'gps' });
  } catch (error: any) {
    console.error('❌ Location API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
