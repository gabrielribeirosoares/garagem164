import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRole, useProfile } from "@/hooks/useAuth";
import { useOwnedStore, useActiveClientStore, useCustomerPoints, useMyStores, setActiveStoreSlug } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Flame, Car, Gift, LayoutDashboard, Package, PlusCircle, LogOut, Trophy, Store, User as UserIcon, ChevronDown, Ticket, ShoppingBag, Boxes } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Clear local session on auth failure to prevent infinite redirect loops
      await supabase.auth.signOut().catch(() => {});
      throw redirect({ to: "/auth" });
    }
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
  const { data: myStores } = useMyStores();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const { data: profile } = useProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
    if (profile?.whatsapp) {
      setWhatsapp(profile.whatsapp);
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async ({ name, wa }: { name: string; wa: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name, whatsapp: wa })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Perfil atualizado com sucesso!");
      setProfileOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const path = location.pathname;
  const isAdmin = role === "admin";
  const isAdminView = path.startsWith("/admin");
  const brand = isAdminView ? ownedStore : activeStore;
  const primaryColor = brand?.primary_color || "#f97316";

  useEffect(() => {
    if (!brand) return;
    const prevTitle = document.title;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    const prevFavicon = link ? link.href : "/favicon.ico";

    if (brand.name) {
      document.title = `${brand.name} | ${isAdminView ? "Painel Admin" : "Minha Garagem"}`;
    }
    if (brand.favicon_url) {
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = brand.favicon_url;
    }

    return () => {
      document.title = prevTitle;
      if (link) {
        link.href = prevFavicon;
      }
    };
  }, [brand, isAdminView]);

  // Link user to active store when accessing authenticated area as a client
  useEffect(() => {
    if (user && activeStore?.id) {
      supabase.rpc("link_user_to_store", { _store_id: activeStore.id }).then(({ error }) => {
        if (error) console.error("Error linking user to store:", error);
      });
    }
  }, [user, activeStore?.id]);

  const clientNav = [
    { to: "/garagem", label: "Garagem", icon: Car },
    { to: "/loja", label: "Vitrine", icon: ShoppingBag },
    { to: "/recompensas", label: "Recompensas", icon: Gift },
    { to: "/rifas", label: "Rifas", icon: Ticket },
    { to: "/ranking", label: "Ranking", icon: Trophy },
  ] as const;

  const adminNav = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/estoque", label: "Estoque", icon: Boxes },
    { to: "/admin/carros", label: "Adicionar Carro", icon: PlusCircle },
    { to: "/admin/garagens", label: "Garagens", icon: Car },
    { to: "/admin/recompensas", label: "Recompensas", icon: Package },
    { to: "/admin/resgates", label: "Resgates", icon: Gift },
    { to: "/admin/rifas", label: "Rifas", icon: Ticket },
  ] as const;

  const nav = isAdminView ? adminNav : clientNav;

  return (
    <div className="min-h-screen pb-24 md:pb-8" style={{ "--store-primary": primaryColor } as React.CSSProperties}>
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          {!isAdminView ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 cursor-pointer text-left focus:outline-none">
                  {brand?.logo_url ? (
                    <img src={brand.logo_url} alt={brand.name} className="h-7 w-7 rounded object-cover" />
                  ) : (
                    <Store className="h-5 w-5" style={{ color: primaryColor }} />
                  )}
                  <span className="font-black tracking-tight truncate flex items-center gap-1">
                    {brand?.name ?? "Minha Loja"}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-card border-border text-foreground align-start">
                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Minhas Lojas
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                {myStores?.map((s: any) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={async () => {
                      setActiveStoreSlug(s.slug);
                      await qc.invalidateQueries();
                      navigate({ to: "/garagem" });
                    }}
                    className={`flex items-center justify-between cursor-pointer focus:bg-muted/50 ${
                      s.id === brand?.id ? "font-bold text-primary" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={s.name} className="h-5 w-5 rounded object-cover" />
                      ) : (
                        <Store className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="truncate">{s.name}</span>
                    </div>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-black shrink-0">
                      {s.points} pts
                    </span>
                  </DropdownMenuItem>
                ))}
                {(!myStores || myStores.length === 0) && (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    Nenhuma loja vinculada.
                  </div>
                )}
                <DropdownMenuSeparator className="bg-border" />
                {!ownedStore && (
                  <DropdownMenuItem
                    onClick={() => navigate({ to: "/create-store" })}
                    className="cursor-pointer focus:bg-muted/50 gap-2 font-bold text-primary"
                  >
                    <Flame className="h-4 w-4" />
                    Criar minha loja
                  </DropdownMenuItem>
                )}
                {ownedStore && (
                  <DropdownMenuItem
                    onClick={() => navigate({ to: "/admin" })}
                    className="cursor-pointer focus:bg-muted/50 gap-2 font-bold text-primary"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Painel da minha loja
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 cursor-pointer text-left focus:outline-none">
                  {brand?.logo_url ? (
                    <img src={brand.logo_url} alt={brand.name} className="h-7 w-7 rounded object-cover" />
                  ) : (
                    <Store className="h-5 w-5" style={{ color: primaryColor }} />
                  )}
                  <span className="font-black tracking-tight truncate flex items-center gap-1">
                    {brand?.name ?? "Minha Loja"}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-card border-border text-foreground align-start">
                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Minha Loja (Admin)
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => navigate({ to: "/admin" })}
                  className="cursor-pointer focus:bg-muted/50 gap-2 font-bold text-primary"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {ownedStore?.name ?? "Painel Admin"}
                </DropdownMenuItem>
                {myStores && myStores.length > 0 && (
                  <>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Lojas que sou cliente
                    </DropdownMenuLabel>
                    {myStores.map((s: any) => (
                      <DropdownMenuItem
                        key={s.id}
                        onClick={async () => {
                          setActiveStoreSlug(s.slug);
                          await qc.invalidateQueries();
                          navigate({ to: "/garagem" });
                        }}
                        className="flex items-center justify-between cursor-pointer focus:bg-muted/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {s.logo_url ? (
                            <img src={s.logo_url} alt={s.name} className="h-5 w-5 rounded object-cover" />
                          ) : (
                            <Store className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="truncate">{s.name}</span>
                        </div>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-black shrink-0">
                          {s.points} pts
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
            {!isAdminView && activeStore && (
              <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-white font-bold text-sm" style={{ background: activeStore.primary_color || "#f97316" }}>
                <Trophy className="h-4 w-4" />
                <span>{clientPoints ?? 0} pts</span>
              </div>
            )}
            <Button onClick={() => setProfileOpen(true)} variant="ghost" size="icon" title="Meu Perfil">
              <UserIcon className="h-4 w-4" />
            </Button>
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

      {/* Dialog do Perfil */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <UserIcon className="h-6 w-6 text-primary" /> Meu Perfil
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.mutate({ name: fullName, wa: whatsapp });
            }}
            className="space-y-4 pt-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile?.email || ""}
                disabled
                className="bg-muted/30 border-border text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                required
                className="bg-[#121212] border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="text-sm font-bold text-muted-foreground uppercase tracking-wider">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Ex: (11) 99999-9999"
                className="bg-[#121212] border-border text-foreground"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setProfileOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateProfile.isPending} className="hw-gradient-orange text-white font-bold">
                {updateProfile.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}