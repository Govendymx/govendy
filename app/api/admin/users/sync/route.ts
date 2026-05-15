import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userIds } = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ profiles: [] });
    }

    const admin = supabaseAdmin();
    const uniqueIds = Array.from(new Set(userIds)) as string[];

    // 1. Try to fetch existing profiles
    const { data: existingProfiles, error: fetchError } = await admin
      .from('profiles')
      .select('id, full_name, first_name, last_name, email, created_at')
      .in('id', uniqueIds);

    if (fetchError) throw fetchError;

    const profileMap = new Map();
    existingProfiles?.forEach(p => profileMap.set(p.id, p));

    const missingIds = uniqueIds.filter(id => !profileMap.has(id));
    const restoredProfiles: any[] = [];
    const errors: any[] = [];

    // 2. For missing IDs, fetch from Auth and restore (Parallel execution for performance)
    if (missingIds.length > 0) {
      console.log(`[Sync] Attempting to restore ${missingIds.length} missing profiles...`);
      
      const restorePromises = missingIds.map(async (id) => {
        try {
          const { data: { user }, error: authError } = await admin.auth.admin.getUserById(id);
          
          if (authError || !user) {
            console.warn(`[Sync] User ${id} not found in Auth:`, authError?.message);
            errors.push({ id, error: 'User not found in Auth' });
            return null;
          }

          // Construct profile data from metadata
          const meta = user.user_metadata || {};
          const fullName = meta.full_name || meta.name || user.email?.split('@')[0] || 'Usuario Restaurado';
          
          let fn = '';
          let ln = '';
          if (fullName) {
            const parts = fullName.split(' ');
            if (parts.length > 0) fn = parts[0];
            if (parts.length > 1) ln = parts.slice(1).join(' ');
          }

          const profileData = {
            id: user.id,
            email: user.email,
            full_name: fullName,
            first_name: fn,
            last_name: ln,
            role: 'user', // Default role
            created_at: user.created_at,
            updated_at: new Date().toISOString()
          };

          // Upsert into profiles
          const { error: insertError } = await admin
            .from('profiles')
            .upsert(profileData)
            .select()
            .single();

          if (insertError) {
            console.error(`[Sync] Failed to insert profile for ${id}:`, insertError.message);
            errors.push({ id, error: insertError.message });
            return null;
          } else {
            return profileData;
          }
        } catch (e: any) {
          console.error(`[Sync] Unexpected error for ${id}:`, e.message);
          errors.push({ id, error: e.message });
          return null;
        }
      });

      const results = await Promise.all(restorePromises);
      results.forEach(profile => {
        if (profile) {
          restoredProfiles.push(profile);
          profileMap.set(profile.id, profile);
        }
      });
    }

    return NextResponse.json({
      success: true,
      profiles: Array.from(profileMap.values()),
      restoredCount: restoredProfiles.length,
      missingCount: missingIds.length,
      errors
    });

  } catch (error: any) {
    console.error('[Sync] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
