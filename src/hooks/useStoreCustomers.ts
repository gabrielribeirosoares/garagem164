import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUnlinkedCustomerIds } from "@/lib/customerStore";

export interface StoreCustomer {
  id: string;
  full_name: string | null;
  email: string | null;
  points: number;
  whatsapp: string | null;
}

export function useStoreCustomers(storeId: string | undefined) {
  return useQuery({
    queryKey: ["admin-customers", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<StoreCustomer[]> => {
      const { data, error } = await supabase.rpc("get_store_customers", {
        _store_id: storeId!,
      });
      if (error) throw error;
      const unlinkedIds = getUnlinkedCustomerIds(storeId);
      return (data ?? [])
        .map((r: any) => ({
          id: r.user_id,
          full_name: r.full_name,
          email: r.email,
          points: r.points,
          whatsapp: r.whatsapp,
        }))
        .filter((c: StoreCustomer) => !unlinkedIds.includes(c.id))
        .sort((a: StoreCustomer, b: StoreCustomer) =>
          (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "")
        );
    },
  });
}
