-- Migration to add SaaS subscription management fields to stores
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');

-- Update store update policies so master admins can manage subscriptions
DROP POLICY IF EXISTS "owners_update_stores" ON public.stores;
CREATE POLICY "owners_update_stores" ON public.stores FOR UPDATE TO authenticated 
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) 
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
