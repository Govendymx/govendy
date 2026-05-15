import { supabaseAdmin } from '@/lib/supabase/admin';
import { GeoLocation, UserIP } from './types';
import { UAParser } from 'ua-parser-js';

// Simple in-memory cache to avoid rate limiting
const geoCache = new Map<string, { data: GeoLocation; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

// Helper: Haversine distance in km
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export class IPService {
  /**
   * Get geolocation for an IP address (with robust error handling)
   */
  async getGeoLocation(ip: string): Promise<GeoLocation | null> {
    if (!ip || ip === '::1' || ip === '127.0.0.1') {
      console.log('Skipping localhost IP');
      return null;
    }

    // Check cache first
    const cached = geoCache.get(ip);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Geo cache HIT for', ip);
      return cached.data;
    }

    // Try ipapi.co (free tier, no key required)
    try {
      console.log('Fetching geo for IP:', ip);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch(`https://ipapi.co/${ip}/json/`, {
        headers: { 'User-Agent': 'GoVendy-App/1.0' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`GeoIP API ${res.status} for ${ip}`);
        return null;
      }

      const data = await res.json();

      if (data.error) {
        console.warn('GeoIP error:', data.reason);
        return null;
      }

      const geoData: GeoLocation = {
        ip,
        country: data.country_name || data.country || 'Unknown',
        city: data.city || 'Unknown',
        region: data.region || 'Unknown',
        lat: data.latitude || null,
        lon: data.longitude || null,
        isp: data.org || 'Unknown ISP'
      };

      // Cache it
      geoCache.set(ip, { data: geoData, timestamp: Date.now() });
      console.log('Geo fetched successfully for', ip);

      return geoData;
    } catch (error: any) {
      console.warn('Geo fetch failed (non-fatal):', error.message);
      return null; // Don't throw, just return null
    }
  }

  /**
   * Record a user's IP address (NEVER throws errors)
   */
  async recordUserIP(userId: string, ip: string, userAgent?: string): Promise<void> {
    try {
      const admin = supabaseAdmin();

      // 1. Check if recently recorded
      const { data: recent } = await admin
        .from('user_ips')
        .select('id, detected_at')
        .eq('user_id', userId)
        .eq('ip_address', ip)
        .gt('detected_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1);

      if (recent && recent.length > 0) {
        console.log('IP already recorded recently, skipping');
        return;
      }

      // 2. Fetch Geo (may return null, that's OK)
      const geo = await this.getGeoLocation(ip);

      // 3. IMPOSSIBLE TRAVEL CHECK (optional, only if we have geo)
      if (geo && geo.lat && geo.lon) {
        const { data: lastIpEntry } = await admin
          .from('user_ips')
          .select('*')
          .eq('user_id', userId)
          .neq('ip_address', ip)
          .order('detected_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastIpEntry && lastIpEntry.latitude && lastIpEntry.longitude) {
          const distKm = getDistanceFromLatLonInKm(
            lastIpEntry.latitude,
            lastIpEntry.longitude,
            geo.lat,
            geo.lon
          );

          const timeDiffHours = (Date.now() - new Date(lastIpEntry.detected_at).getTime()) / (1000 * 60 * 60);
          const effectiveTime = Math.max(timeDiffHours, 0.1);
          const speed = distKm / effectiveTime;

          if (speed > 800 && distKm > 100) {
            // Create security alert
            const { error: alertError } = await admin.from('security_alerts').insert({
              type: 'IMPOSSIBLE_TRAVEL',
              user_id: userId,
              ip_address: ip,
              severity: 'high',
              status: 'new',
              details: {
                prev_ip: lastIpEntry.ip_address,
                prev_loc: `${lastIpEntry.city}, ${lastIpEntry.country}`,
                curr_loc: `${geo.city}, ${geo.country}`,
                distance_km: Math.round(distKm),
                time_diff_hours: timeDiffHours.toFixed(2),
                speed_kmh: Math.round(speed)
              }
            });
            
            if (alertError) {
              console.error('Failed to create alert:', alertError);
            }
          }
        }
      }

      // 4. Parse User Agent
      let deviceMetadata = {};
      if (userAgent) {
        try {
          const parser = new UAParser(userAgent);
          deviceMetadata = parser.getResult();
        } catch (e) {
          console.warn('UA parse failed:', e);
        }
      }

      // 5. Insert record (ALWAYS, even if geo is null)
      const insertData: any = {
        user_id: userId,
        ip_address: ip,
        user_agent: userAgent,
        is_approximate: true,
        metadata: {
          ...(geo ? { raw_geo: geo } : { geo_lookup_failed: true }),
          ...deviceMetadata
        }
      };

      // Add geo data if available
      if (geo) {
        insertData.country = geo.country;
        insertData.city = geo.city;
        insertData.region = geo.region;
        insertData.isp = geo.isp;
        insertData.latitude = geo.lat;
        insertData.longitude = geo.lon;
      }

      const { error } = await admin.from('user_ips').insert(insertData);

      if (error) {
        console.error('Failed to insert user_ip:', error);
        throw error;
      }

      console.log('✅ User IP recorded successfully');
    } catch (error: any) {
      console.error('❌ recordUserIP failed:', error);
      // Don't re-throw - let the API continue
    }
  }

  /**
   * Get User's recent IPs
   */
  async getUserIPs(userId: string, limit = 5): Promise<UserIP[]> {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from('user_ips')
      .select('*')
      .eq('user_id', userId)
      .order('detected_at', { ascending: false })
      .limit(limit);
    return (data as UserIP[]) || [];
  }
}

export const ipService = new IPService();
