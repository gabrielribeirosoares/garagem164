import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";

const ACTIVE_STORE_KEY = "gm.active_store_slug";

export function getActiveStoreSlug(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_STORE_KEY);
}

export function setActiveStoreSlug(slug: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_STORE_KEY, slug);
  window.dispatchEvent(new Event("gm-active-store"));
}

export function useActiveStoreSlug() {
  const [slug, setSlug] = useState<string | null>(() => getActiveStoreSlug());
  useEffect(() => {
    const on = () => setSlug(getActiveStoreSlug());
    window.addEventListener("gm-active-store", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("gm-active-store", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return slug;
}

/** Store owned by the current authenticated user, if any. */
export function useOwnedStore() {
  const user = useSession();
  return useQuery({
    queryKey: ["owned-store", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useStoreBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["store-by-slug", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Client-facing active store: from localStorage, resolved to a row. */
export function useActiveClientStore() {
  const user = useSession();
  const slug = useActiveStoreSlug();
  return useQuery({
    queryKey: ["active-client-store", user?.id, slug],
    enabled: !!user,
    queryFn: async () => {
      if (slug) {
        const { data } = await supabase.from("stores").select("*").eq("slug", slug).maybeSingle();
        if (data) return data;
      }
      // fallback: first store where user has a customer_points row
      const { data: cp } = await supabase
        .from("customer_points")
        .select("store_id, stores:stores!customer_points_store_id_fkey(*)")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      const store = (cp as any)?.stores ?? null;
      if (store?.slug) setActiveStoreSlug(store.slug);
      return store;
    },
  });
}

/** Points balance for the current user in a given store. */
export function useCustomerPoints(storeId: string | undefined) {
  const user = useSession();
  return useQuery({
    queryKey: ["customer-points", user?.id, storeId],
    enabled: !!user && !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_points")
        .select("points")
        .eq("user_id", user!.id)
        .eq("store_id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return data?.points ?? 0;
    },
  });
}