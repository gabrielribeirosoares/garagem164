-- Add image columns to raffles table for single and multiple prize images
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';
