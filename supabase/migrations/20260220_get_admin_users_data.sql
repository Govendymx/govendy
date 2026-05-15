-- Function: get_admin_users_data
-- Purpose: Returns combined profile + auth email data for a list of user IDs.
-- Security: SECURITY DEFINER so it can read auth.users. Only callable by authenticated users.
-- The RLS check on admin_users is done in the application layer before calling this RPC.

CREATE OR REPLACE FUNCTION get_admin_users_data(user_ids uuid[])
RETURNS TABLE (
  id          uuid,
  full_name   text,
  first_name  text,
  last_name   text,
  email       text,
  state       text,
  city        text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id,
    p.full_name,
    p.first_name,
    p.last_name,
    COALESCE(au.email, 'Sin email') AS email,
    p.state,
    p.city
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE p.id = ANY(user_ids);
$$;

-- Grant execute to authenticated users (admin check is done in client code)
GRANT EXECUTE ON FUNCTION get_admin_users_data(uuid[]) TO authenticated;
