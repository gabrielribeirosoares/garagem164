-- Add foreign key constraints between tables (customer_points, cars, redemptions) and profiles table
-- to allow PostgREST (Supabase) to perform joins correctly.

ALTER TABLE public.customer_points
DROP CONSTRAINT IF EXISTS customer_points_user_id_profiles_fkey;

ALTER TABLE public.customer_points
ADD CONSTRAINT customer_points_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.cars
DROP CONSTRAINT IF EXISTS cars_user_id_profiles_fkey;

ALTER TABLE public.cars
ADD CONSTRAINT cars_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.redemptions
DROP CONSTRAINT IF EXISTS redemptions_user_id_profiles_fkey;

ALTER TABLE public.redemptions
ADD CONSTRAINT redemptions_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
