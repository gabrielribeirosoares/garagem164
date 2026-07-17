import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: store } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_id", userData.user.id)
      .maybeSingle();
    if (!store) {
      throw redirect({ to: "/create-store" });
    }
    const queryClient = (context as any)?.queryClient;
    if (queryClient) {
      queryClient.setQueryData(["owned-store", userData.user.id], store);
    }
  },
  component: () => <Outlet />,
});