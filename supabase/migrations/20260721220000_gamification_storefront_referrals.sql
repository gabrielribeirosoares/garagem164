-- 1. Create store_inventory table for diecast catalog / stock storefront
CREATE TABLE IF NOT EXISTS public.store_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0.00,
  points_reward integer NOT NULL DEFAULT 10,
  image_url text,
  category text NOT NULL DEFAULT 'Mainline', -- 'Mainline', 'Premium', 'TH', 'STH', 'Custom'
  stock_quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'available', -- 'available', 'reserved', 'sold'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for store_inventory
ALTER TABLE public.store_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_owner_all ON public.store_inventory;
CREATE POLICY "inventory_owner_all" ON public.store_inventory FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));

DROP POLICY IF EXISTS inventory_public_read ON public.store_inventory;
CREATE POLICY "inventory_public_read" ON public.store_inventory FOR SELECT TO authenticated
  USING (TRUE);

-- Realtime for store_inventory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'store_inventory'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.store_inventory;
  END IF;
END $$;

-- 2. Add referral tracking columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Touch updated_at trigger for store_inventory
DROP TRIGGER IF EXISTS trg_store_inventory_touch ON public.store_inventory;
CREATE TRIGGER trg_store_inventory_touch BEFORE UPDATE ON public.store_inventory
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
