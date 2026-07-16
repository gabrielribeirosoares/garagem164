import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRole } from "@/hooks/useAuth";
import { useOwnedStore, useActiveClientStore, useCustomerPoints } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Flame, Car, Gift, LayoutDashboard, Package, PlusCircle, LogOut, Trophy, Store } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const user = useSession();
  const { data: role } = useRole();
  const { data: ownedStore } = useOwnedStore();
  const { data: activeStore } = useActiveClientStore();
  const { data: clientPoints } = useCustomerPoints(activeStore?.id);
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isAdmin = role === "admin";
  const path = location.pathname;
  const brand = isAdmin ? ownedStore : activeStore;

  const clientNav = [
    { to: "/garagem", label: "Garagem", icon: Car },
    { to: "/recompensas", label: "Recompensas", icon: Gift },
  ] as const;

  const adminNav = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/carros", label: "Adicionar Carro", icon: PlusCircle },
    { to: "/admin/garagens", label: "Garagens de clientes", icon: Car },
    { to: "/admin/recompensas", label: "Recompensas", icon: Package },
    { to: "/admin/resgates", label: "Resgates", icon: Gift },
  ] as const;

  const nav = isAdmin ? adminNav : clientNav;

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <Link to={isAdmin ? "/admin" : "/garagem"} className="flex items-center gap-2 min-w-0">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} className="h-7 w-7 rounded object-cover" />
            ) : (
              <Store className="h-5 w-5" style={{ color: brand?.primary_color || undefined }} />
            )}
            <span className="font-black tracking-tight truncate">{brand?.name ?? "Minha Loja"}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => {
              const active = path === n.to || (n.to !== "/admin" && path.startsWith(n.to));
              return (
                <Link key={n.to} to={n.to}>
                  <Button variant={active ? "secondary" : "ghost"} size="sm" className="gap-2">
                    <n.icon className="h-4 w-4" /> {n.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {!isAdmin && activeStore && (
              <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-white font-bold text-sm" style={{ background: activeStore.primary_color || "#f97316" }}>
                <Trophy className="h-4 w-4" />
                <span>{clientPoints ?? 0} pts</span>
              </div>
            )}
            <Button onClick={signOut} variant="ghost" size="icon" title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 animate-in fade-in duration-500">
        {user && role ? <Outlet /> : <div className="text-muted-foreground text-sm">Carregando...</div>}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="grid grid-flow-col auto-cols-fr">
          {nav.map((n) => {
            const active = path === n.to || (n.to !== "/admin" && path.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-1 py-3 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
                <n.icon className="h-5 w-5" />
                <span className="truncate max-w-full px-1">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}