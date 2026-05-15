-- Pocket Academy - Sistema de Entrenamiento y Certificación
-- Ejecutar en Supabase SQL Editor

-- 1. Tabla de Módulos (Cursos)
CREATE TABLE IF NOT EXISTS public.academy_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'admin', 'seller', 'support'
  level TEXT DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Lecciones
CREATE TABLE IF NOT EXISTS public.academy_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT, -- Markdown content
  video_url TEXT,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Progreso de Usuario
CREATE TABLE IF NOT EXISTS public.academy_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'started', -- 'started', 'completed'
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, lesson_id)
);

-- 4. Tabla de Certificaciones
CREATE TABLE IF NOT EXISTS public.academy_certifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_certifications ENABLE ROW LEVEL SECURITY;

-- Policies (Abiertas para lectura, restringidas para escritura)
-- En producción, restringir escritura a admins. Aquí simplificamos para MVP.

CREATE POLICY "Modules viewable by everyone" ON public.academy_modules FOR SELECT USING (true);
CREATE POLICY "Lessons viewable by everyone" ON public.academy_lessons FOR SELECT USING (true);

CREATE POLICY "Users manage their own progress" ON public.academy_progress
  USING (auth.uid() = user_id);

CREATE POLICY "Users view their certs" ON public.academy_certifications
  FOR SELECT USING (auth.uid() = user_id);

-- SEED DATA (Datos de prueba para el entrenamiento solicitado)

DO $$
DECLARE
  mod_id UUID;
BEGIN
  -- Crear Módulo: Fundamentos de la Plataforma
  INSERT INTO public.academy_modules (title, description, category, level)
  VALUES (
    'Dominio de la Plataforma GoPocket',
    'Programa educativo estructurado para eliminar errores recurrentes y dominar todas las funcionalidades.',
    'admin',
    'advanced'
  ) RETURNING id INTO mod_id;

  -- Lección 1: Navegación Básica
  INSERT INTO public.academy_lessons (module_id, title, content, "order")
  VALUES (
    mod_id,
    'Navegación y Dashboard',
    '# Navegación del Sistema\n\nAprende a moverte por el panel de administración sin perderte.\n\n1. **Sidebar**: Menú principal a la izquierda.\n2. **Metrics**: Indicadores en tiempo real.\n3. **Search**: Barra de búsqueda global (usa UUIDs o Referencias PCK).',
    1
  );

  -- Lección 2: Gestión de Usuarios
  INSERT INTO public.academy_lessons (module_id, title, content, "order")
  VALUES (
    mod_id,
    'Gestión de Usuarios y Permisos',
    '# Usuarios\n\nCómo gestionar usuarios, suspender cuentas y revisar perfiles de riesgo.\n\n- **Verificación**: Revisa documentos en /admin/verifications.\n- **Suspensiones**: Usa el botón "Suspender" con precaución.',
    2
  );

  -- Lección 3: Resolución de Problemas (AI & Errores)
  INSERT INTO public.academy_lessons (module_id, title, content, "order")
  VALUES (
    mod_id,
    'Resolución de Problemas con Admin Intelligence',
    '# Uso de la IA\n\nAdmin Intelligence puede diagnosticar problemas.\n\n- **Consultas por ID**: Pega un UUID o referencia PCK-XXXXXX.\n- **Errores Comunes**: Si ves "Error consultando datos", verifica las variables de entorno.',
    3
  );

END $$;
