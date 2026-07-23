-- RPC to allow store owners to unlink a customer and remove their store points/garage
CREATE OR REPLACE FUNCTION public.unlink_customer(_user_id uuid, _store_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o proprietário da loja pode desvincular clientes.';
  END IF;

  -- 1. Remove customer_points for this store
  DELETE FROM public.customer_points WHERE user_id = _user_id AND store_id = _store_id;

  -- 2. Remove cars in garage for this store
  DELETE FROM public.cars WHERE user_id = _user_id AND store_id = _store_id;

  -- 3. Clear user_id on tickets reserved by this user in this store
  UPDATE public.raffle_tickets 
  SET user_id = NULL, status = 'reserved'
  WHERE user_id = _user_id 
    AND raffle_id IN (SELECT id FROM public.raffles WHERE store_id = _store_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.unlink_customer(uuid, uuid) TO authenticated;
