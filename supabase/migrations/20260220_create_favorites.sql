-- ──────────────────────────────────────────────────────
-- Favorites (Wishlist / Heart Button)
-- Users can save listings as favorites. The heart button
-- in ListingCard reads and writes to this table.
-- ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.favorites (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id  uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT favorites_user_listing_unique UNIQUE (user_id, listing_id)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON public.favorites (user_id);
-- Index for fast per-listing lookups (e.g. count favorites on a product)
CREATE INDEX IF NOT EXISTS favorites_listing_id_idx ON public.favorites (listing_id);

-- ── RLS ─────────────────────────────────────────────────
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Users can only see their own favorites
CREATE POLICY "favorites_select_own"
    ON public.favorites FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "favorites_insert_own"
    ON public.favorites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "favorites_delete_own"
    ON public.favorites FOR DELETE
    USING (auth.uid() = user_id);
