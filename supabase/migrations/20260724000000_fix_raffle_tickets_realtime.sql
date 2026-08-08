-- Migration: Fix Realtime for raffle tickets
-- ==============================================
-- PROBLEM:
--   Migration 20260722143336 restricted SELECT on public.raffle_tickets to
--   own tickets or store owner. Supabase Realtime respects RLS policies, so
--   when user A reserves a number, user B never receives the realtime event
--   (B cannot read A's row). The number only appears as taken when B tries
--   to click it and gets "Os seguintes números já estavam ocupados".
--
-- SOLUTION:
--   Restore SELECT for all authenticated users (as originally designed with
--   the comment "Let customers see who took which numbers"). This makes the
--   realtime subscription deliver events to every user viewing the raffle,
--   so the grid updates in real time and users cannot click taken numbers.
-- ==============================================

DROP POLICY IF EXISTS "tickets_user_read" ON public.raffle_tickets;
CREATE POLICY "tickets_user_read" ON public.raffle_tickets
FOR SELECT TO authenticated
USING (TRUE); -- Let customers see who took which numbers (needed for Realtime)