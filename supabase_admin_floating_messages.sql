-- Tabla para mensajes flotantes del administrador
-- Estos mensajes aparecen como flotantes para todos los usuarios

CREATE TABLE IF NOT EXISTS public.admin_floating_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contenido del mensaje
  title TEXT NOT NULL DEFAULT '',
  content_html TEXT, -- Contenido HTML del mensaje
  image_url TEXT, -- URL de imagen (si es mensaje de imagen)
  message_type TEXT NOT NULL DEFAULT 'html' CHECK (message_type IN ('html', 'image')),
  
  -- Ubicación y sección
  section TEXT NOT NULL DEFAULT 'all' CHECK (section IN ('all', 'dashboard', 'listings', 'cart', 'sell', 'profile', 'ventas', 'compras', 'preguntas', 'respuestas', 'pagos', 'favoritos', 'reputacion', 'devoluciones', 'coupons', 'ayuda', 'soporte')),
  position_x INTEGER DEFAULT 20, -- Posición X inicial (px desde la izquierda)
  position_y INTEGER DEFAULT 20, -- Posición Y inicial (px desde arriba)
  
  -- Vigencia
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  ends_at TIMESTAMP WITH TIME ZONE, -- NULL = sin fecha de fin
  
  -- Estilo
  width INTEGER DEFAULT 320, -- Ancho del mensaje en px
  height INTEGER DEFAULT NULL, -- Alto del mensaje en px (NULL = auto)
  background_color TEXT DEFAULT '#ffffff',
  text_color TEXT DEFAULT '#000000',
  border_color TEXT DEFAULT '#e5e7eb',
  z_index INTEGER DEFAULT 10000,
  
  -- Configuración
  is_draggable BOOLEAN DEFAULT true,
  is_closable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  
  -- Metadatos
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS admin_floating_messages_section_idx ON public.admin_floating_messages (section);
CREATE INDEX IF NOT EXISTS admin_floating_messages_starts_at_idx ON public.admin_floating_messages (starts_at);
CREATE INDEX IF NOT EXISTS admin_floating_messages_ends_at_idx ON public.admin_floating_messages (ends_at);
CREATE INDEX IF NOT EXISTS admin_floating_messages_is_active_idx ON public.admin_floating_messages (is_active);
CREATE INDEX IF NOT EXISTS admin_floating_messages_created_at_idx ON public.admin_floating_messages (created_at DESC);

-- Tabla para rastrear qué mensajes ha cerrado cada usuario
CREATE TABLE IF NOT EXISTS public.user_closed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.admin_floating_messages(id) ON DELETE CASCADE,
  closed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS user_closed_messages_user_id_idx ON public.user_closed_messages (user_id);
CREATE INDEX IF NOT EXISTS user_closed_messages_message_id_idx ON public.user_closed_messages (message_id);

-- RLS: Solo admins pueden ver/editar mensajes
ALTER TABLE public.admin_floating_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_closed_messages ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer mensajes activos
DROP POLICY IF EXISTS "Anyone can read active floating messages" ON public.admin_floating_messages;
CREATE POLICY "Anyone can read active floating messages"
  ON public.admin_floating_messages
  FOR SELECT
  USING (is_active = true);

-- Política: Solo admins pueden insertar/actualizar/eliminar
DROP POLICY IF EXISTS "Admins can manage floating messages" ON public.admin_floating_messages;
CREATE POLICY "Admins can manage floating messages"
  ON public.admin_floating_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
    )
  );

-- Política: Usuarios pueden leer sus propios mensajes cerrados
DROP POLICY IF EXISTS "Users can read their closed messages" ON public.user_closed_messages;
CREATE POLICY "Users can read their closed messages"
  ON public.user_closed_messages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuarios pueden insertar sus propios mensajes cerrados
DROP POLICY IF EXISTS "Users can insert their closed messages" ON public.user_closed_messages;
CREATE POLICY "Users can insert their closed messages"
  ON public.user_closed_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_admin_floating_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_admin_floating_messages_updated_at_trigger ON public.admin_floating_messages;
CREATE TRIGGER update_admin_floating_messages_updated_at_trigger
  BEFORE UPDATE ON public.admin_floating_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_floating_messages_updated_at();
