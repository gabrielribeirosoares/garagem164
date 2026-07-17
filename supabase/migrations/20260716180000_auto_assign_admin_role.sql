-- Automatically assign the 'admin' role to the store owner when a new store is created
CREATE OR REPLACE FUNCTION public.on_store_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.owner_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_on_store_insert ON public.stores;
CREATE TRIGGER trg_on_store_insert AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.on_store_insert();

-- Backfill: Make sure all existing store owners have the 'admin' role
INSERT INTO public.user_roles (user_id, role)
SELECT owner_id, 'admin'::public.app_role
FROM public.stores
ON CONFLICT (user_id, role) DO NOTHING;
