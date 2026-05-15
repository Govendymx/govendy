-- ============================================
-- ACTIVAR REALTIME PARA NOTIFICACIONES
-- ============================================
-- Ejecuta este script en el Editor SQL de Supabase
-- para asegurar que las notificaciones lleguen en tiempo real (campanita).

-- 1. Asegurar que la tabla está en la publicación 'supabase_realtime'
begin;
  -- Intentar agregar la tabla a la publicación
  -- (Usamos un bloque DO para evitar error si ya existe)
  do $$
  begin
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end;
  $$;
commit;

-- 2. Verificar índices para rendimiento
create index if not exists notifications_user_is_read_idx 
  on public.notifications (user_id) 
  where is_read = false;

-- 3. Confirmación
select 
  p.pubname as publicacion,
  t.tablename as tabla
from pg_publication_tables p
join pg_tables t on p.tablename = t.tablename
where p.pubname = 'supabase_realtime'
  and t.tablename = 'notifications';
