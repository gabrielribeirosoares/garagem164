-- reserve_tickets_batch.sql
-- Run this in Supabase SQL editor (SQL) to create an RPC that reserves raffle numbers safely.

CREATE OR REPLACE FUNCTION public.reserve_tickets_batch(
  p_raffle_id uuid,
  p_user_id uuid,
  p_participant_name text,
  p_numbers integer[]
)
RETURNS TABLE(number integer, status text, ticket_id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
  inserted_id uuid;
BEGIN
  IF p_numbers IS NULL THEN
    RETURN;
  END IF;

  FOREACH n IN ARRAY p_numbers LOOP
    BEGIN
      INSERT INTO raffle_tickets (raffle_id, number, participant_name, user_id, status, created_at)
      VALUES (p_raffle_id, n, p_participant_name, p_user_id, 'reserved', now())
      RETURNING id INTO inserted_id;

      number := n;
      status := 'reserved';
      ticket_id := inserted_id;
      RETURN NEXT;
    EXCEPTION WHEN unique_violation THEN
      -- number already taken
      number := n;
      status := 'taken';
      ticket_id := NULL;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- Usage example (Supabase client):
-- const { data, error } = await supabase.rpc('reserve_tickets_batch', {
--   p_raffle_id: selectedRaffleId,
--   p_user_id: user.id,
--   p_participant_name: participantName,
--   p_numbers: [1,2,3]
-- });

-- The function returns rows with columns: number, status ('reserved'|'taken'), ticket_id (uuid or null).
