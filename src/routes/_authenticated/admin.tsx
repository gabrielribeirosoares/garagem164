import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: stores } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_id", userData.user.id)
      .limit(1);
    if (!stores || stores.length === 0) {
      throw redirect({ to: "/create-store" });
    }
  },
  component: () => <Outlet />,
});