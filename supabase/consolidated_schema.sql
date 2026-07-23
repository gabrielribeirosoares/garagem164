-- ==============================================
-- MIGRATION: 20260715232234_c413dfce-a91b-48c1-9342-6a508506024d.sql
-- ==============================================

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'client');
CREATE TYPE public.reward_category AS ENUM ('coupon', 'shipping', 'miniature');
CREATE TYPE public.redemption_status AS ENUM ('pending', 'completed', 'cancelled');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Profile policies
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Admin reads all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Admin updates all profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admin reads all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Cars
CREATE TABLE public.cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cars TO authenticated;
GRANT ALL ON public.cars TO service_role;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own cars" ON public.cars FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admin manages all cars" ON public.cars FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Rewards
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category public.reward_category NOT NULL,
  image_url TEXT,
  cost INTEGER NOT NULL CHECK (cost >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read rewards" ON public.rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages rewards" ON public.rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Redemptions
CREATE TABLE public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL,
  reward_title TEXT NOT NULL,
  reward_category public.reward_category NOT NULL,
  cost INTEGER NOT NULL,
  status public.redemption_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.redemptions TO authenticated;
GRANT UPDATE ON public.redemptions TO authenticated;
GRANT ALL ON public.redemptions TO service_role;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own redemptions" ON public.redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admin reads all redemptions" ON public.redemptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own redemptions" ON public.redemptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin updates redemptions" ON public.redemptions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: create profile + assign client role on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: on car insert, add points to profile
CREATE OR REPLACE FUNCTION public.on_car_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET points = points + NEW.points WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cars_add_points
  AFTER INSERT ON public.cars
  FOR EACH ROW EXECUTE FUNCTION public.on_car_insert();

-- Trigger: on car delete, subtract points
CREATE OR REPLACE FUNCTION public.on_car_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET points = GREATEST(points - OLD.points, 0) WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER cars_subtract_points
  AFTER DELETE ON public.cars
  FOR EACH ROW EXECUTE FUNCTION public.on_car_delete();

-- Trigger: on redemption insert, deduct points (fail if insufficient)
CREATE OR REPLACE FUNCTION public.on_redemption_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_points INTEGER;
BEGIN
  SELECT points INTO current_points FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;
  IF current_points IS NULL OR current_points < NEW.cost THEN
    RAISE EXCEPTION 'Pontos insuficientes para este resgate';
  END IF;
  UPDATE public.profiles SET points = points - NEW.cost WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER redemptions_deduct_points
  BEFORE INSERT ON public.redemptions
  FOR EACH ROW EXECUTE FUNCTION public.on_redemption_insert();

-- Trigger: on redemption cancel, refund
CREATE OR REPLACE FUNCTION public.on_redemption_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.profiles SET points = points + OLD.cost WHERE id = OLD.user_id;
  END IF;
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER redemptions_status_update
  BEFORE UPDATE ON public.redemptions
  FOR EACH ROW EXECUTE FUNCTION public.on_redemption_update();

-- Realtime for redemptions and cars and profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.redemptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cars;


-- ==============================================
-- MIGRATION: 20260716000000_add_payment_and_shipping.sql
-- ==============================================
-- Add payment_status and shipping_status to cars table
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS shipping_status TEXT NOT NULL DEFAULT 'pending';


-- ==============================================
-- MIGRATION: 20260716174106_c3ab00cc-7332-4a39-bb54-8eb9cbd632c8.sql
-- ==============================================

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


-- ==============================================
-- MIGRATION: 20260716180000_auto_assign_admin_role.sql
-- ==============================================
-- Automatically assign the 'admin' role to the store owner when a new store is created
CREATE OR REPLACE FUNCTION public.on_store_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.owner_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_on_store_insert ON public.stores;
CREATE TRIGGER trg_on_store_insert AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.on_store_insert();

-- Backfill: Make sure all existing store owners have the 'admin' role
INSERT INTO public.user_roles (user_id, role)
SELECT owner_id, 'admin'::public.app_role
FROM public.stores
ON CONFLICT (user_id, role) DO NOTHING;


-- ==============================================
-- MIGRATION: 20260716190000_link_user_to_store.sql
-- ==============================================
-- RPC function to link the authenticated user to a store in customer_points
CREATE OR REPLACE FUNCTION public.link_user_to_store(_store_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.customer_points (user_id, store_id, points)
  VALUES (auth.uid(), _store_id, 0)
  ON CONFLICT (user_id, store_id) DO NOTHING;
END; $$;

GRANT EXECUTE ON FUNCTION public.link_user_to_store(uuid) TO authenticated;


-- ==============================================
-- MIGRATION: 20260716200000_update_handle_new_user.sql
-- ==============================================
-- Update handle_new_user to automatically register new users into customer_points if register_store_id metadata is supplied
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_store_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- Attempt to extract register_store_id safely from raw_user_meta_data
  BEGIN
    target_store_id := (NEW.raw_user_meta_data->>'register_store_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    target_store_id := NULL;
  END;

  -- Link user directly to the store with 0 points
  IF target_store_id IS NOT NULL THEN
    INSERT INTO public.customer_points (user_id, store_id, points)
    VALUES (NEW.id, target_store_id, 0)
    ON CONFLICT (user_id, store_id) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;


-- ==============================================
-- MIGRATION: 20260717223000_link_customer_by_email.sql
-- ==============================================
-- RPC function to allow store owners to link an existing customer by email
CREATE OR REPLACE FUNCTION public.link_customer_by_email(_email text, _store_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Verify the caller is the owner of the store
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o proprietário da loja pode vincular clientes.';
  END IF;

  -- Find the user ID by email in profiles
  SELECT id INTO target_user_id FROM public.profiles WHERE lower(email) = lower(_email);
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário encontrado com o e-mail informado.';
  END IF;

  -- Link the customer to the store
  INSERT INTO public.customer_points (user_id, store_id, points)
  VALUES (target_user_id, _store_id, 0)
  ON CONFLICT (user_id, store_id) DO NOTHING;
END; $$;

GRANT EXECUTE ON FUNCTION public.link_customer_by_email(text, uuid) TO authenticated;


-- ==============================================
-- MIGRATION: 20260717224700_add_profiles_foreign_keys.sql
-- ==============================================
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


-- ==============================================
-- MIGRATION: 20260717230000_admin_rpc_functions.sql
-- ==============================================
-- =============================================================
-- SCRIPT COMPLETO: Execute este UNICO script no Supabase SQL Editor
-- Ele configura TUDO de uma vez.
-- =============================================================

-- 1. Trigger handle_new_user: Cria perfil + vincula automaticamente à loja durante o registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_store_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- Attempt to extract register_store_id safely from raw_user_meta_data
  BEGIN
    target_store_id := (NEW.raw_user_meta_data->>'register_store_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    target_store_id := NULL;
  END;

  -- Link user directly to the store with 0 points
  IF target_store_id IS NOT NULL THEN
    INSERT INTO public.customer_points (user_id, store_id, points)
    VALUES (NEW.id, target_store_id, 0)
    ON CONFLICT (user_id, store_id) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. RPC: Listar clientes da loja com dados de perfil (para o painel admin)
CREATE OR REPLACE FUNCTION public.get_store_customers(_store_id uuid)
RETURNS TABLE(user_id uuid, full_name text, email text, points integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o proprietário da loja pode listar clientes.';
  END IF;
  RETURN QUERY
  SELECT cp.user_id, p.full_name, p.email, cp.points
  FROM public.customer_points cp
  LEFT JOIN public.profiles p ON p.id = cp.user_id
  WHERE cp.store_id = _store_id
  ORDER BY COALESCE(p.full_name, p.email, '');
END; $$;

GRANT EXECUTE ON FUNCTION public.get_store_customers(uuid) TO authenticated;

-- 3. RPC: Vincular cliente por e-mail (para o admin vincular manualmente)
CREATE OR REPLACE FUNCTION public.link_customer_by_email(_email text, _store_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o proprietário da loja pode vincular clientes.';
  END IF;
  SELECT id INTO target_user_id FROM public.profiles WHERE lower(email) = lower(_email);
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário encontrado com o e-mail informado.';
  END IF;
  INSERT INTO public.customer_points (user_id, store_id, points)
  VALUES (target_user_id, _store_id, 0)
  ON CONFLICT (user_id, store_id) DO NOTHING;
END; $$;

GRANT EXECUTE ON FUNCTION public.link_customer_by_email(text, uuid) TO authenticated;

-- 4. RPC: Vincular o usuario autenticado a uma loja (para o cliente se vincular)
CREATE OR REPLACE FUNCTION public.link_user_to_store(_store_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.customer_points (user_id, store_id, points)
  VALUES (auth.uid(), _store_id, 0)
  ON CONFLICT (user_id, store_id) DO NOTHING;
END; $$;

GRANT EXECUTE ON FUNCTION public.link_user_to_store(uuid) TO authenticated;


-- ==============================================
-- MIGRATION: 20260717234000_fix_duplicate_triggers.sql
-- ==============================================
-- 1. Drop duplicate triggers from the first migration to prevent points from being added/subtracted twice
DROP TRIGGER IF EXISTS cars_add_points ON public.cars;
DROP TRIGGER IF EXISTS cars_subtract_points ON public.cars;
DROP TRIGGER IF EXISTS redemptions_deduct_points ON public.redemptions;
DROP TRIGGER IF EXISTS redemptions_status_update ON public.redemptions;

-- 2. Recalculate customer_points correctly for all users and stores
-- Formula: Points = (Sum of points of cars) - (Sum of cost of non-cancelled redemptions)
WITH calculated_points AS (
  SELECT 
    cp.user_id, 
    cp.store_id,
    COALESCE((
      SELECT SUM(c.points) 
      FROM public.cars c 
      WHERE c.user_id = cp.user_id AND c.store_id = cp.store_id
    ), 0) - COALESCE((
      SELECT SUM(r.cost) 
      FROM public.redemptions r 
      WHERE r.user_id = cp.user_id AND r.store_id = cp.store_id AND r.status <> 'cancelled'
    ), 0) as real_points
  FROM public.customer_points cp
)
UPDATE public.customer_points cp
SET points = GREATEST(cp_calc.real_points, 0)
FROM calculated_points cp_calc
WHERE cp.user_id = cp_calc.user_id AND cp.store_id = cp_calc.store_id;


-- ==============================================
-- MIGRATION: 20260717234400_add_whatsapp_to_profiles.sql
-- ==============================================
-- Add whatsapp column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Update handle_new_user trigger to save whatsapp from raw metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_store_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, email, whatsapp)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
    NEW.email,
    NEW.raw_user_meta_data->>'whatsapp'
  )
  ON CONFLICT (id) DO UPDATE
  SET whatsapp = COALESCE(EXCLUDED.whatsapp, profiles.whatsapp),
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  -- Attempt to extract register_store_id safely from raw_user_meta_data
  BEGIN
    target_store_id := (NEW.raw_user_meta_data->>'register_store_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    target_store_id := NULL;
  END;

  -- Link user directly to the store with 0 points
  IF target_store_id IS NOT NULL THEN
    INSERT INTO public.customer_points (user_id, store_id, points)
    VALUES (NEW.id, target_store_id, 0)
    ON CONFLICT (user_id, store_id) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

-- Update get_store_customers RPC to return whatsapp column
DROP FUNCTION IF EXISTS public.get_store_customers(uuid);
CREATE OR REPLACE FUNCTION public.get_store_customers(_store_id uuid)
RETURNS TABLE(user_id uuid, full_name text, email text, points integer, whatsapp text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o proprietário da loja pode listar clientes.';
  END IF;
  RETURN QUERY
  SELECT cp.user_id, p.full_name, p.email, cp.points, p.whatsapp
  FROM public.customer_points cp
  LEFT JOIN public.profiles p ON p.id = cp.user_id
  WHERE cp.store_id = _store_id
  ORDER BY COALESCE(p.full_name, p.email, '');
END; $$;

GRANT EXECUTE ON FUNCTION public.get_store_customers(uuid) TO authenticated;


-- ==============================================
-- MIGRATION: 20260718000000_setup_storage_bucket.sql
-- ==============================================
-- Create the public bucket 'images' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;


-- Drop old policies if they exist to avoid conflict
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Owner Manage Access" ON storage.objects;

-- Create policies for the public 'images' bucket
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');

CREATE POLICY "Authenticated Owner Manage Access"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'images' AND owner = auth.uid())
WITH CHECK (bucket_id = 'images' AND owner = auth.uid());


-- ==============================================
-- MIGRATION: 20260721210000_add_raffles.sql
-- ==============================================
-- Create raffles table
CREATE TABLE IF NOT EXISTS public.raffles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price_per_number numeric(10,2) NOT NULL DEFAULT 5.00,
  points_per_number integer NOT NULL DEFAULT 0,
  pix_key text,
  total_numbers integer NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'active', -- 'active', 'drawn', 'cancelled'
  winner_number integer,
  winner_name text,
  winner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  drawn_at timestamptz
);

-- Enable RLS for raffles
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;

-- Policies for raffles
DROP POLICY IF EXISTS raffles_owner_all ON public.raffles;
CREATE POLICY "raffles_owner_all" ON public.raffles FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));

DROP POLICY IF EXISTS raffles_public_read ON public.raffles;
CREATE POLICY "raffles_public_read" ON public.raffles FOR SELECT TO authenticated
  USING (TRUE); -- Let any logged in user see active/drawn raffles for their stores

-- Create raffle_tickets table
CREATE TABLE IF NOT EXISTS public.raffle_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  number integer NOT NULL,
  participant_name text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'reserved', -- 'reserved', 'paid'
  points_awarded boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (raffle_id, number)
);

-- Enable RLS for raffle_tickets
ALTER TABLE public.raffle_tickets ENABLE ROW LEVEL SECURITY;

-- Policies for raffle_tickets
DROP POLICY IF EXISTS tickets_owner_all ON public.raffle_tickets;
CREATE POLICY "tickets_owner_all" ON public.raffle_tickets FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.raffles r 
    WHERE r.id = raffle_tickets.raffle_id AND public.is_store_owner(r.store_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.raffles r 
    WHERE r.id = raffle_tickets.raffle_id AND public.is_store_owner(r.store_id, auth.uid())
  ));

DROP POLICY IF EXISTS tickets_user_read ON public.raffle_tickets;
CREATE POLICY "tickets_user_read" ON public.raffle_tickets FOR SELECT TO authenticated
  USING (TRUE); -- Let customers see who took which numbers

DROP POLICY IF EXISTS tickets_user_insert_own ON public.raffle_tickets;
CREATE POLICY "tickets_user_insert_own" ON public.raffle_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()); -- Let users reserve numbers for themselves

DROP POLICY IF EXISTS tickets_user_delete_own_reserved ON public.raffle_tickets;
CREATE POLICY "tickets_user_delete_own_reserved" ON public.raffle_tickets FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'reserved');

-- Realtime replication for raffles and tickets (safely check first to avoid duplicating errors if run repeatedly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'raffles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.raffles;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'raffle_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.raffle_tickets;
  END IF;
END $$;

-- Trigger to award points automatically when ticket is marked paid
CREATE OR REPLACE FUNCTION public.on_raffle_ticket_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_points_per_number integer;
  v_store_id uuid;
BEGIN
  -- Get points and store_id from the raffle
  SELECT points_per_number, store_id INTO v_points_per_number, v_store_id
  FROM public.raffles WHERE id = COALESCE(NEW.raffle_id, OLD.raffle_id);

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- If ticket is marked paid and points aren't awarded yet, and we have a user_id
    IF NEW.status = 'paid' AND NEW.points_awarded = FALSE AND NEW.user_id IS NOT NULL AND v_points_per_number > 0 THEN
      -- Ensure customer_points row exists
      INSERT INTO public.customer_points (user_id, store_id, points)
      VALUES (NEW.user_id, v_store_id, 0)
      ON CONFLICT (user_id, store_id) DO NOTHING;

      -- Award points
      UPDATE public.customer_points
      SET points = points + v_points_per_number, updated_at = now()
      WHERE user_id = NEW.user_id AND store_id = v_store_id;

      NEW.points_awarded = TRUE;
    -- If ticket was paid but is now changed to reserved/cancelled, or user_id was removed
    ELSIF TG_OP = 'UPDATE' AND (OLD.status = 'paid' AND OLD.points_awarded = TRUE) AND (NEW.status <> 'paid' OR NEW.user_id IS NULL) AND v_points_per_number > 0 THEN
      UPDATE public.customer_points
      SET points = GREATEST(points - v_points_per_number, 0), updated_at = now()
      WHERE user_id = OLD.user_id AND store_id = v_store_id;

      NEW.points_awarded = FALSE;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- If ticket was paid and points were awarded, subtract points on deletion
    IF OLD.status = 'paid' AND OLD.points_awarded = TRUE AND OLD.user_id IS NOT NULL AND v_points_per_number > 0 THEN
      UPDATE public.customer_points
      SET points = GREATEST(points - v_points_per_number, 0), updated_at = now()
      WHERE user_id = OLD.user_id AND store_id = v_store_id;
    END IF;
    RETURN OLD;
  END IF;
END; $$;

DROP TRIGGER IF EXISTS trg_on_raffle_ticket_change ON public.raffle_tickets;
CREATE TRIGGER trg_on_raffle_ticket_change
  BEFORE INSERT OR UPDATE ON public.raffle_tickets
  FOR EACH ROW EXECUTE FUNCTION public.on_raffle_ticket_change();

DROP TRIGGER IF EXISTS trg_on_raffle_ticket_delete ON public.raffle_tickets;
CREATE TRIGGER trg_on_raffle_ticket_delete
  AFTER DELETE ON public.raffle_tickets
  FOR EACH ROW EXECUTE FUNCTION public.on_raffle_ticket_change();


-- ==============================================
-- MIGRATION: 20260721220000_gamification_storefront_referrals.sql
-- ==============================================
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


-- ==============================================
-- MIGRATION: 20260722143336_cd092f64-8d7e-490c-8a2d-2ba564ea640f.sql
-- ==============================================

-- 1) Prevent self-edit of profiles.points
CREATE OR REPLACE FUNCTION public.prevent_profile_points_selfedit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.points IS DISTINCT FROM OLD.points THEN
    RAISE EXCEPTION 'Direct modification of points is not allowed';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_block_points_selfedit ON public.profiles;
CREATE TRIGGER profiles_block_points_selfedit
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_points_selfedit();

-- Tighten UPDATE policy with WITH CHECK
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2) Validate redemption fields against rewards catalog
CREATE OR REPLACE FUNCTION public.on_redemption_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_points integer;
  v_reward public.rewards%ROWTYPE;
BEGIN
  IF NEW.reward_id IS NULL THEN
    RAISE EXCEPTION 'reward_id is required';
  END IF;

  SELECT * INTO v_reward FROM public.rewards WHERE id = NEW.reward_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recompensa não encontrada';
  END IF;
  IF NOT v_reward.active THEN
    RAISE EXCEPTION 'Recompensa indisponível';
  END IF;
  IF v_reward.store_id <> NEW.store_id THEN
    RAISE EXCEPTION 'Recompensa não pertence a esta loja';
  END IF;

  -- Overwrite client-supplied values with authoritative catalog values
  NEW.cost := v_reward.cost;
  NEW.reward_title := v_reward.title;
  NEW.reward_category := v_reward.category;

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

-- 3) Restrict raffle_tickets SELECT to own tickets or store owner
DROP POLICY IF EXISTS "tickets_user_read" ON public.raffle_tickets;
CREATE POLICY "tickets_user_read" ON public.raffle_tickets
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.raffles r
    WHERE r.id = raffle_tickets.raffle_id
      AND public.is_store_owner(r.store_id, auth.uid())
  )
);

-- Public view exposing only non-PII fields so UIs can still display taken numbers
CREATE OR REPLACE VIEW public.raffle_ticket_numbers
WITH (security_invoker = true) AS
SELECT id, raffle_id, number, status FROM public.raffle_tickets;
GRANT SELECT ON public.raffle_ticket_numbers TO anon, authenticated;

-- 4) Storage: restrict listing in public "images" bucket to file owner
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Images owner list" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'images' AND owner = auth.uid());
-- Public file access remains via the public bucket's CDN URLs (no policy needed for signed/public object fetch by URL on public buckets).

-- 5) Fix mutable search_path on tg_touch_updated_at
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 6) Lock down SECURITY DEFINER function EXECUTE grants
-- Trigger functions never need EXECUTE grants
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_car_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_car_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_redemption_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_redemption_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_raffle_ticket_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_profile_points_selfedit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC, anon, authenticated;

-- RPCs and RLS helpers: only signed-in users
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_store_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_store_owner(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.link_user_to_store(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_user_to_store(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.link_customer_by_email(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_customer_by_email(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_store_customers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_customers(uuid) TO authenticated;


-- ==============================================
-- MIGRATION: 20260722210000_add_raffle_images.sql
-- ==============================================
-- Add image columns to raffles table for single and multiple prize images
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';


-- ==============================================
-- MIGRATION: 20260722220000_enhance_raffles_features.sql
-- ==============================================
-- Add new columns for enhanced raffle features (draw date, shipping info, item condition)
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS draw_date timestamptz;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS shipping_info text;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS item_condition text;


-- ==============================================
-- MIGRATION: 20260722230000_harden_security_and_anti_exploit.sql
-- ==============================================
-- Migration: Harden Database Security & Prevent Bypassing / Exploits
-- 1. Tighten RLS on public.raffle_tickets for INSERT
DROP POLICY IF EXISTS tickets_user_insert_own ON public.raffle_tickets;
CREATE POLICY "tickets_user_insert_own" ON public.raffle_tickets FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'reserved'
    AND (points_awarded IS FALSE OR points_awarded IS NULL)
  );

-- 2. Enhanced trigger validation for raffle_tickets (prevent forged inserts/updates)
CREATE OR REPLACE FUNCTION public.on_raffle_ticket_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_points_per_number integer;
  v_store_id uuid;
  v_total_numbers integer;
  v_raffle_status text;
  v_is_owner boolean;
BEGIN
  -- Get raffle rules
  SELECT points_per_number, store_id, total_numbers, status 
  INTO v_points_per_number, v_store_id, v_total_numbers, v_raffle_status
  FROM public.raffles WHERE id = COALESCE(NEW.raffle_id, OLD.raffle_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rifa não encontrada.';
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Check if current user is store owner
    v_is_owner := public.is_store_owner(v_store_id, auth.uid());

    -- Prevent reserving on inactive/drawn raffles
    IF v_raffle_status <> 'active' AND NOT v_is_owner THEN
      RAISE EXCEPTION 'Esta rifa não está mais ativa para novas reservas.';
    END IF;

    -- Validate ticket number within raffle boundaries
    IF NEW.number < 1 OR NEW.number > v_total_numbers THEN
      RAISE EXCEPTION 'Número fora dos limites válidos desta rifa (1 a %).', v_total_numbers;
    END IF;

    -- Non-owners cannot mark tickets as paid or force points_awarded
    IF NOT v_is_owner THEN
      IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status <> 'paid') THEN
        RAISE EXCEPTION 'Apenas o administrador da loja pode confirmar pagamentos de rifa.';
      END IF;
      IF NEW.points_awarded = TRUE AND (TG_OP = 'INSERT' OR OLD.points_awarded = FALSE) THEN
        RAISE EXCEPTION 'Modificação de pontos concedidos não permitida.';
      END IF;
    END IF;

    -- If ticket is marked paid and points aren't awarded yet, and we have a user_id
    IF NEW.status = 'paid' AND NEW.points_awarded = FALSE AND NEW.user_id IS NOT NULL AND v_points_per_number > 0 THEN
      -- Ensure customer_points row exists
      INSERT INTO public.customer_points (user_id, store_id, points)
      VALUES (NEW.user_id, v_store_id, 0)
      ON CONFLICT (user_id, store_id) DO NOTHING;

      -- Award points
      UPDATE public.customer_points
      SET points = points + v_points_per_number, updated_at = now()
      WHERE user_id = NEW.user_id AND store_id = v_store_id;

      NEW.points_awarded = TRUE;
    -- If ticket was paid but is now changed to reserved/cancelled, or user_id was removed
    ELSIF TG_OP = 'UPDATE' AND (OLD.status = 'paid' AND OLD.points_awarded = TRUE) AND (NEW.status <> 'paid' OR NEW.user_id IS NULL) AND v_points_per_number > 0 THEN
      UPDATE public.customer_points
      SET points = GREATEST(points - v_points_per_number, 0), updated_at = now()
      WHERE user_id = OLD.user_id AND store_id = v_store_id;

      NEW.points_awarded = FALSE;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- If ticket was paid and points were awarded, subtract points on deletion
    IF OLD.status = 'paid' AND OLD.points_awarded = TRUE AND OLD.user_id IS NOT NULL AND v_points_per_number > 0 THEN
      UPDATE public.customer_points
      SET points = GREATEST(points - v_points_per_number, 0), updated_at = now()
      WHERE user_id = OLD.user_id AND store_id = v_store_id;
    END IF;
    RETURN OLD;
  END IF;
END; $$;

-- Revoke direct execution on trigger function
REVOKE ALL ON FUNCTION public.on_raffle_ticket_change() FROM PUBLIC, anon, authenticated;

-- 3. Ensure NO direct INSERT/UPDATE/DELETE policies exist on public.customer_points for authenticated users
DROP POLICY IF EXISTS "cp_user_insert_own" ON public.customer_points;
DROP POLICY IF EXISTS "cp_user_update_own" ON public.customer_points;
DROP POLICY IF EXISTS "cp_user_delete_own" ON public.customer_points;

-- ==============================================
-- MIGRATION: 20260723180000_add_saas_subscriptions.sql
-- ==============================================
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');

DROP POLICY IF EXISTS "owners_update_stores" ON public.stores;
CREATE POLICY "owners_update_stores" ON public.stores FOR UPDATE TO authenticated 
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) 
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

