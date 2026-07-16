
-- 1. STORES
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  favicon_url text,
  primary_color text NOT NULL DEFAULT '#f97316',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stores_owner_idx ON public.stores(owner_id);
GRANT SELECT ON public.stores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "owners_insert_stores" ON public.stores FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owners_update_stores" ON public.stores FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owners_delete_stores" ON public.stores FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- 2. Helper: is user the owner of this store?
CREATE OR REPLACE FUNCTION public.is_store_owner(_store_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = _user_id);
$$;

-- 3. Seed default store from existing admin, backfill store_id
DO $$
DECLARE
  admin_id uuid;
  default_store uuid;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.stores (owner_id, name, slug, primary_color)
    VALUES (admin_id, 'Gonzaga Minis', 'gonzagaminis', '#f97316')
    RETURNING id INTO default_store;
  END IF;

  ALTER TABLE public.cars ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
  ALTER TABLE public.rewards ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
  ALTER TABLE public.redemptions ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

  IF default_store IS NOT NULL THEN
    UPDATE public.cars SET store_id = default_store WHERE store_id IS NULL;
    UPDATE public.rewards SET store_id = default_store WHERE store_id IS NULL;
    UPDATE public.redemptions SET store_id = default_store WHERE store_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.cars ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.rewards ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.redemptions ALTER COLUMN store_id SET NOT NULL;
CREATE INDEX cars_store_idx ON public.cars(store_id);
CREATE INDEX rewards_store_idx ON public.rewards(store_id);
CREATE INDEX redemptions_store_idx ON public.redemptions(store_id);

-- 4. customer_points (per store balance)
CREATE TABLE public.customer_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);
CREATE INDEX customer_points_store_idx ON public.customer_points(store_id);
GRANT SELECT ON public.customer_points TO authenticated;
GRANT ALL ON public.customer_points TO service_role;
ALTER TABLE public.customer_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_user_reads_own" ON public.customer_points FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "cp_owner_reads_store" ON public.customer_points FOR SELECT TO authenticated USING (public.is_store_owner(store_id, auth.uid()));

-- Backfill customer_points from profiles.points for the default store
INSERT INTO public.customer_points (user_id, store_id, points)
SELECT p.id, s.id, p.points
FROM public.profiles p
CROSS JOIN public.stores s
WHERE s.slug = 'gonzagaminis'
ON CONFLICT (user_id, store_id) DO NOTHING;

-- 5. Rewrite triggers for per-store points
CREATE OR REPLACE FUNCTION public.on_car_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.customer_points (user_id, store_id, points)
  VALUES (NEW.user_id, NEW.store_id, NEW.points)
  ON CONFLICT (user_id, store_id)
  DO UPDATE SET points = customer_points.points + NEW.points, updated_at = now();
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.on_car_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.customer_points
  SET points = GREATEST(points - OLD.points, 0), updated_at = now()
  WHERE user_id = OLD.user_id AND store_id = OLD.store_id;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.on_redemption_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_points integer;
BEGIN
  SELECT points INTO current_points FROM public.customer_points
  WHERE user_id = NEW.user_id AND store_id = NEW.store_id FOR UPDATE;
  IF current_points IS NULL OR current_points < NEW.cost THEN
    RAISE EXCEPTION 'Pontos insuficientes para este resgate';
  END IF;
  UPDATE public.customer_points
  SET points = points - NEW.cost, updated_at = now()
  WHERE user_id = NEW.user_id AND store_id = NEW.store_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.on_redemption_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.customer_points
    SET points = points + OLD.cost, updated_at = now()
    WHERE user_id = OLD.user_id AND store_id = OLD.store_id;
  END IF;
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END; $$;

-- Ensure triggers exist (in case they were missing)
DROP TRIGGER IF EXISTS trg_on_car_insert ON public.cars;
CREATE TRIGGER trg_on_car_insert AFTER INSERT ON public.cars
FOR EACH ROW EXECUTE FUNCTION public.on_car_insert();

DROP TRIGGER IF EXISTS trg_on_car_delete ON public.cars;
CREATE TRIGGER trg_on_car_delete AFTER DELETE ON public.cars
FOR EACH ROW EXECUTE FUNCTION public.on_car_delete();

DROP TRIGGER IF EXISTS trg_on_redemption_insert ON public.redemptions;
CREATE TRIGGER trg_on_redemption_insert BEFORE INSERT ON public.redemptions
FOR EACH ROW EXECUTE FUNCTION public.on_redemption_insert();

DROP TRIGGER IF EXISTS trg_on_redemption_update ON public.redemptions;
CREATE TRIGGER trg_on_redemption_update BEFORE UPDATE ON public.redemptions
FOR EACH ROW EXECUTE FUNCTION public.on_redemption_update();

-- 6. Refactor handle_new_user: create profile only, no automatic role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

-- 7. Rewrite RLS for cars / rewards / redemptions to be store-scoped
DROP POLICY IF EXISTS "Admin manages all cars" ON public.cars;
DROP POLICY IF EXISTS "Users read own cars" ON public.cars;
CREATE POLICY "cars_owner_all" ON public.cars FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));
CREATE POLICY "cars_user_read_own" ON public.cars FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin manages rewards" ON public.rewards;
DROP POLICY IF EXISTS "Authenticated read rewards" ON public.rewards;
CREATE POLICY "rewards_owner_all" ON public.rewards FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));
CREATE POLICY "rewards_public_read_active" ON public.rewards FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Admin reads all redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Admin updates redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Users create own redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Users read own redemptions" ON public.redemptions;
CREATE POLICY "redemptions_owner_all" ON public.redemptions FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));
CREATE POLICY "redemptions_user_read_own" ON public.redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "redemptions_user_insert_own" ON public.redemptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 8. Profiles: keep existing user-owned policies, drop admin-global ones
DROP POLICY IF EXISTS "Admin reads all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin updates all profiles" ON public.profiles;
-- Store owners can read profiles of clients that have any points row in their store
CREATE POLICY "profiles_owner_reads_customers" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customer_points cp
    JOIN public.stores s ON s.id = cp.store_id
    WHERE cp.user_id = profiles.id AND s.owner_id = auth.uid()
  ));

-- 9. updated_at trigger for stores
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_stores_touch ON public.stores;
CREATE TRIGGER trg_stores_touch BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
