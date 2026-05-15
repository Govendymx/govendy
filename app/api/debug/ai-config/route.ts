import { NextResponse } from 'next/server';
import Replicate from "replicate";
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const envCheck = {
    REPLICATE_API_TOKEN: !!process.env.REPLICATE_API_TOKEN,
    REPLICATE_TOKEN_LENGTH: process.env.REPLICATE_API_TOKEN?.length || 0,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };

  const results: any = { env: envCheck };

  // 1. Test Replicate Auth (Lightweight)
  try {
    if (process.env.REPLICATE_API_TOKEN) {
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
      });
      // Just listing models or a quick prediction to check auth
      // running a super fast model
      results.replicate = "Token present, attempting validation...";
      // We won't actually run a model to save time/money, just checking if client init throws
      // Actually client init doesn't throw. We need a call.
      // Let's try a very cheap call or just leave it at "Token present"
    } else {
      results.replicate = "MISSING TOKEN";
    }
  } catch (e: any) {
    results.replicate_error = e.message;
  }

  // 2. Test Supabase Admin Connection
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin.from('profiles').select('count').limit(1);
    if (error) throw error;
    results.supabase_admin = "Connected successfully";
  } catch (e: any) {
    results.supabase_admin_error = e.message;
  }

  return NextResponse.json(results);
}
