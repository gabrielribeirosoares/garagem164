-- RPC function to link the authenticated user to a store in customer_points
CREATE OR REPLACE FUNCTION public.link_user_to_store(_store_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.customer_points (user_id, store_id, points)
  VALUES (auth.uid(), _store_id, 0)
  ON CONFLICT (user_id, store_id) DO NOTHING;
END; $$;

GRANT EXECUTE ON FUNCTION public.link_user_to_store(uuid) TO authenticated;
