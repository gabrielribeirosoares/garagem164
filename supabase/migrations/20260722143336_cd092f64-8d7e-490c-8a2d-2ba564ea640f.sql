
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
