-- Add last_reminder_at column to cart_items to track abandoned cart notifications
ALTER TABLE public.cart_items 
ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN public.cart_items.last_reminder_at IS 'Timestamp of the last abandoned cart email sent for this item.';
