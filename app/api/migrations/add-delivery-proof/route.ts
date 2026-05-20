import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const connectionString = 'postgresql://postgres:Govendy031187.@db.qclnkkvwevopshzflzuc.supabase.co:5432/postgres';
  
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('[MIGRATION] Connecting to direct Supabase PostgreSQL...');
    await client.connect();
    console.log('[MIGRATION] Connected to direct Supabase PostgreSQL successfully.');

    console.log('[MIGRATION] Running ALTER TABLE public.orders ADD COLUMN...');
    await client.query('ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;');
    console.log('[MIGRATION] Successfully added delivery_proof_url column.');

    console.log('[MIGRATION] Running COMMENT ON COLUMN...');
    await client.query("COMMENT ON COLUMN public.orders.delivery_proof_url IS 'URL de la evidencia de entrega (foto firmada) para entregas personales';");
    console.log('[MIGRATION] Successfully commented delivery_proof_url column.');

    await client.end();
    
    return NextResponse.json({
      ok: true,
      message: 'Migration executed successfully! Added delivery_proof_url column to orders table.'
    });
  } catch (error: any) {
    console.error('[MIGRATION] Error:', error);
    try {
      await client.end();
    } catch {}
    
    return NextResponse.json({
      ok: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
