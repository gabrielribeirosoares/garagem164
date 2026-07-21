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
