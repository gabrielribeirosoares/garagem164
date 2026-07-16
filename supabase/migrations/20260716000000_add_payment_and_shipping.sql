-- Add payment_status and shipping_status to cars table
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS shipping_status TEXT NOT NULL DEFAULT 'pending';
