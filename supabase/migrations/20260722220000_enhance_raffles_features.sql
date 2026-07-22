-- Add new columns for enhanced raffle features (draw date, shipping info, item condition)
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS draw_date timestamptz;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS shipping_info text;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS item_condition text;
