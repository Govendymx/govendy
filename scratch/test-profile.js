import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) {
    console.error('Error listUsers:', userErr);
    return;
  }
  
  const user = users.users.find(u => u.email === 'indelimx@gmail.com');
  if (!user) {
    console.log('User not found');
    return;
  }

  const { data: profile, error: profErr } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (profErr) {
    console.error('Error fetching profile:', profErr);
    return;
  }

  console.log('Current profile:', profile);

  const payload = {
    ...profile,
    zip_code: '91180' // try updating
  };

  const { error: upErr } = await supabase.from('profiles').upsert([payload]).select('*').single();
  if (upErr) {
    console.error('UPSERT ERROR:', upErr);
  } else {
    console.log('Upsert success!');
  }
}

run();
