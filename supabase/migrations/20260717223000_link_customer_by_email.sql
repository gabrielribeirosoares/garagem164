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
