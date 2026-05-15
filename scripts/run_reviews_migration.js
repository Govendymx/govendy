const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

// Usar la Supabase Management API (pg endpoint)
// URL: https://<project-ref>.supabase.co/rest/v1/rpc o el endpoint de admin
// Alternativa: usar el endpoint de Postgres directamente

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Variables de entorno no encontradas');
    process.exit(1);
}

// Extraer el project ref de la URL
// https://xyz.supabase.co -> xyz
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
console.log(`📦 Project: ${projectRef}`);

const SQL = `
-- 1. Tabla principal de reseñas
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 0.5 AND rating <= 5.0),
  title TEXT,
  content TEXT,
  images TEXT[],
  feature_ratings JSONB DEFAULT '{}'::jsonb,
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_reviews_listing_id ON product_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON product_reviews(created_at DESC);

-- 2. Tabla de votos
CREATE TABLE IF NOT EXISTS product_review_votes (
  review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type INTEGER NOT NULL CHECK (vote_type IN (1, -1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (review_id, user_id)
);

-- 3. RLS
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_review_votes ENABLE ROW LEVEL SECURITY;

-- 4. Políticas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='product_reviews' AND policyname='Reviews are visible to everyone') THEN
    CREATE POLICY "Reviews are visible to everyone" ON product_reviews FOR SELECT USING (status = 'active');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='product_reviews' AND policyname='Users can create reviews') THEN
    CREATE POLICY "Users can create reviews" ON product_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='product_reviews' AND policyname='Users can update own reviews') THEN
    CREATE POLICY "Users can update own reviews" ON product_reviews FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='product_review_votes' AND policyname='Votes are visible to everyone') THEN
    CREATE POLICY "Votes are visible to everyone" ON product_review_votes FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='product_review_votes' AND policyname='Users can vote') THEN
    CREATE POLICY "Users can vote" ON product_review_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='product_review_votes' AND policyname='Users can delete own vote') THEN
    CREATE POLICY "Users can delete own vote" ON product_review_votes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
`;

async function runMigration() {
    console.log('🚀 Aplicando migración de product_reviews...\n');

    // Usar la API de PostgreSQL de Supabase (disponible via Management API)
    const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

    const res = await fetch(mgmtUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ query: SQL }),
    });

    const text = await res.text();

    if (res.ok) {
        console.log('✅ Migración aplicada exitosamente');
        console.log(text);
    } else {
        console.log(`⚠️  Management API respondió: ${res.status}`);
        console.log(text);

        // Intentar con el endpoint alternativo via pg-meta
        console.log('\n🔄 Intentando vía endpoint alternativo...');

        // Usar ensure_schema via INSERT a una tabla de control (no disponible directamente)
        // La forma más simple: usar fetch al endpoint de Supabase SQL
        const altUrl = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
        const res2 = await fetch(altUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'apikey': SERVICE_KEY,
            },
            body: JSON.stringify({ sql: SQL }),
        });

        const text2 = await res2.text();
        if (res2.ok) {
            console.log('✅ Migración aplicada por endpoint alternativo');
        } else {
            console.log('❌ No se pudo aplicar la migración automáticamente.');
            console.log('\n📋 COPIA ESTE SQL EN EL EDITOR SQL DE SUPABASE (supabase.com > proyecto > SQL Editor):\n');
            console.log(SQL);
        }
    }
}

runMigration().catch(console.error);
