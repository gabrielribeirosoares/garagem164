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
