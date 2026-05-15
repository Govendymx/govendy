const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qclnkkvwevopshzflzuc.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjbG5ra3Z3ZXZvcHNoemZsenVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc4ODM3NSwiZXhwIjoyMDk0MzY0Mzc1fQ.WG5rTT7K76YfCKeNppsFVORzLKen_PUR1YWfQHbGXIk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testing storage bucket...');
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) {
    console.error('Error listing buckets:', bucketErr);
    return;
  }
  
  const ident = buckets.find(b => b.name === 'identificaciones');
  if (!ident) {
    console.error('Bucket "identificaciones" not found!');
  } else {
    console.log('Bucket "identificaciones" exists. Public:', ident.public);
  }

  // Let's test a simple dummy upload
  console.log('\nTesting upload to identificaciones...');
  const { data: upData, error: upErr } = await supabase.storage
    .from('identificaciones')
    .upload('test/dummy.txt', Buffer.from('hello'), { upsert: true });
    
  if (upErr) {
    console.error('Upload Error:', upErr);
  } else {
    console.log('Upload Success:', upData);
  }
}

run();
