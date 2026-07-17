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
