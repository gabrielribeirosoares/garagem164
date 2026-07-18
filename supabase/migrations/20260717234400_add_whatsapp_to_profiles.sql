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
