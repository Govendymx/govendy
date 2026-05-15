const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno manualmente sin dotenv
const envPath = path.join(__dirname, '.env.local');
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ''); // Quitar comillas si existen
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value;
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseServiceKey = value;
    }
  });
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  const sqlPath = path.join(__dirname, 'ADD_BRAND_MODEL_TO_LISTINGS.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Ejecutando migración SQL...');
  
  // Intentar ejecutar via RPC 'exec_sql'
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error ejecutando SQL vía RPC:', error);
      console.log('Intentando método alternativo si exec_sql no existe...');
      
      // Si falla, es probable que no tengamos exec_sql. 
      // En un entorno real, tendríamos que pedir al usuario que lo ejecute en el dashboard.
      // O intentar usar la API de postgres si estuviéramos en backend real.
    } else {
      console.log('Migración completada exitosamente.');
    }
  } catch (e) {
    console.error('Excepción:', e);
  }
}

runMigration();
