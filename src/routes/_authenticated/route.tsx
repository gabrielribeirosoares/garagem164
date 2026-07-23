import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRole, useProfile } from "@/hooks/useAuth";
import { useOwnedStore, useActiveClientStore, useCustomerPoints, useMyStores, setActiveStoreSlug } from "@/hooks/useStore";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Flame, Car, Gift, LayoutDashboard, Package, PlusCircle, LogOut, Trophy, Store, User as UserIcon, ChevronDown, Ticket, ShoppingBag, Boxes, Sun, Moon, Monitor, ShieldCheck } from "lucide-react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatPhone, getPhoneFlag } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { OnboardingTour } from "@/components/OnboardingTour";
import { SpotlightTour, SpotlightStep } from "@/components/SpotlightTour";
import { Footer } from "@/components/Footer";
import { HelpCircle } from "lucide-react";

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
  const { theme, setTheme } = useTheme();
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
  const [tourOpen, setTourOpen] = useState(false);

  const path = location.pathname;
  const isAdmin = role === "admin";
  const isAdminView = path.startsWith("/admin");

  // Page-specific spotlight steps definition
  const getSpotlightConfig = (): { key: string; steps: SpotlightStep[] } | null => {
    if (isAdminView) {
      if (path === "/admin/rifas") {
        return {
          key: "admin-rifas",
          steps: [
            {
              targetSelector: '[data-tour="admin-rifa-create"]',
              title: "Criar Nova Rifa ➕",
              description: "Clique aqui para cadastrar um novo sorteio definindo prêmios, galeria de fotos, valor por número e chave PIX.",
            },
            {
              targetSelector: '[data-tour="admin-rifa-stats"]',
              title: "Métricas Financeiras 💰",
              description: "Acompanhe em tempo real o valor já recebido (pagos), valor pendente em reservas e a porcentagem de preenchimento da rifa.",
            },
            {
              targetSelector: '[data-tour="admin-rifa-whatsapp"]',
              title: "Copiar Lista Formatada para WhatsApp 📱",
              description: "Clique neste botão para copiar a lista da rifa já organizada com números disponíveis, reservados (com nome do participante), chave PIX e valores para enviar nos grupos e conversas do WhatsApp!",
            },
            {
              targetSelector: '[data-tour="admin-rifa-surpresinha"]',
              title: "Compra Rápida em 1-Clique ⚡",
              description: "Para vendas no balcão ou via WhatsApp, clique em +1, 3, 5 ou 10 números para sortear números livres aleatórios em 1 segundo.",
            },
            {
              targetSelector: '[data-tour="admin-rifa-pending"]',
              title: "Reservas PIX Pendentes 🕒",
              description: "Aprove o pagamento PIX enviado pelo cliente ou cancele a reserva com apenas 1 clique.",
            },
            {
              targetSelector: '[data-tour="admin-rifa-grid"]',
              title: "Painel de Números & Edição 🔢",
              description: "Clique em qualquer número no grid para atribuir compradores, alterar status para pago ou usar a Seleção Inteligente Múltipla.",
            },
          ],
        };
      }
      if (path === "/admin/estoque") {
        return {
          key: "admin-estoque",
          steps: [
            {
              targetSelector: '[data-tour="admin-estoque-add"]',
              title: "Novo Produto ➕",
              description: "Cadastre novas miniaturas no seu estoque definindo preço, pontos, escala e quantidade disponível.",
            },
            {
              targetSelector: '[data-tour="admin-estoque-grid"]',
              title: "Catálogo de Produtos em Estoque 📦",
              description: "Visualize seus produtos em estoque e faça vendas diretas para a garagem dos seus clientes com apenas 1 clique.",
            },
          ],
        };
      }
      if (path === "/admin/carros") {
        return {
          key: "admin-carros",
          steps: [
            {
              targetSelector: '[data-tour="admin-car-name"]',
              title: "Nome do Carro 🚘",
              description: "Pesquise ou digite o modelo da miniatura (ex: Hot Wheels Dodge Charger).",
            },
            {
              targetSelector: '[data-tour="admin-car-photo"]',
              title: "Foto do Produto 📷",
              description: "Tire uma foto direto pela câmera do seu celular, faça upload ou insira a URL da imagem.",
            },
            {
              targetSelector: '[data-tour="admin-car-points"]',
              title: "Pontos na Garagem 🏆",
              description: "Defina quantos pontos o cliente receberá no saldo ao adquirir este modelo.",
            },
            {
              targetSelector: '[data-tour="admin-car-submit"]',
              title: "Adicionar à Garagem 🚀",
              description: "Salva e disponibiliza o carro imediatamente na garagem do cliente ou no estoque.",
            },
          ],
        };
      }
      if (path === "/admin/garagens") {
        return {
          key: "admin-garagens",
          steps: [
            {
              targetSelector: '[data-tour="admin-garagens-select"]',
              title: "Selecionar Garagem do Cliente 👤",
              description: "Pesquise por nome, e-mail ou WhatsApp para abrir e visualizar a garagem de qualquer cliente.",
            },
            {
              targetSelector: '[data-tour="admin-garagens-link"]',
              title: "Vincular Cliente por E-mail 🔗",
              description: "Associe novos compradores da sua loja para creditar pontos e miniaturas na conta deles.",
            },
            {
              targetSelector: '[data-tour="admin-garagens-items"]',
              title: "Itens na Garagem do Cliente 🏎️",
              description: "Veja todas as miniaturas e o histórico de pontos acumulados na garagem do cliente selecionado.",
            },
          ],
        };
      }
      if (path === "/admin/recompensas") {
        return {
          key: "admin-recompensas",
          steps: [
            {
              targetSelector: '[data-tour="admin-recompensas-form"]',
              title: "Cadastrar Nova Recompensa 🎁",
              description: "Cadastre brindes, cupons ou miniaturas grátis definindo a quantidade de pontos necessária para a troca.",
            },
            {
              targetSelector: '[data-tour="admin-recompensas-catalog"]',
              title: "Catálogo de Recompensas Ativas 🏆",
              description: "Gerencie todas as recompensas disponíveis para os clientes resgatarem na loja.",
            },
          ],
        };
      }
      if (path === "/admin/resgates") {
        return {
          key: "admin-resgates",
          steps: [
            {
              targetSelector: '[data-tour="admin-resgates-search"]',
              title: "Buscar Pedido de Resgate 🔍",
              description: "Pesquise pelo código da solicitação (ex: GM-A1B2C3D4) ou pelo nome do cliente.",
            },
            {
              targetSelector: '[data-tour="admin-resgates-list"]',
              title: "Lista de Resgates Solicitados 📦",
              description: "Acompanhe os pedidos de resgate pendentes, concluídos ou cancelados.",
            },
            {
              targetSelector: '[data-tour="admin-resgates-actions"]',
              title: "Aprovar e Marcar Entregue ✅",
              description: "Clique em 'Marcar entregue' para concluir o resgate do prêmio após entregar o produto ao cliente.",
            },
          ],
        };
      }
      if (path === "/admin") {
        return {
          key: "admin-dashboard",
          steps: [
            {
              targetSelector: '[data-tour="admin-metrics"]',
              title: "Visão Geral do Negócio 📊",
              description: "Monitore o número de clientes cadastrados, solicitações de resgates pendentes e total de pontos em circulação.",
            },
            {
              targetSelector: '[data-tour="admin-alerts"]',
              title: "Central de Alertas 🔔",
              description: "Receba notificações instantâneas de solicitações de resgates de prêmios feitas pelos clientes da sua garagem.",
            },
          ],
        };
      }
    } else {
      if (path === "/garagem") {
        return {
          key: "client-garagem",
          steps: [
            {
              targetSelector: '[data-tour="client-garagem-hero"]',
              title: "Sua Garagem Virtual 🚘",
              description: "Aqui você acompanha o seu saldo de pontos acumulados, a contagem de miniaturas na sua coleção e o seu nível VIP.",
            },
          ],
        };
      }
      if (path === "/rifas") {
        return {
          key: "client-rifas",
          steps: [
            {
              targetSelector: '[data-tour="client-rifa-surpresinha"]',
              title: "Compra Rápida Surpresinha 🎲",
              description: "Quer garantir seus números da sorte rápido? Escolha 1, 3, 5 ou 10 números aleatórios em apenas 1 clique!",
            },
          ],
        };
      }
      if (path === "/loja") {
        return {
          key: "client-loja",
          steps: [
            {
              targetSelector: '[data-tour="client-loja-filters"]',
              title: "Filtros por Categoria 🏷️",
              description: "Filtre as miniaturas disponíveis por categoria: Mainline, Premium, Treasure Hunt (TH/STH) ou Custom.",
            },
            {
              targetSelector: '[data-tour="client-loja-grid"]',
              title: "Vitrine de Vendas Direct 🛒",
              description: "Escolha suas miniaturas favoritas e compre direto via WhatsApp. Ao adquirir, a miniatura entra automaticamente na sua garagem virtual!",
            },
          ],
        };
      }
      if (path === "/recompensas") {
        return {
          key: "client-recompensas",
          steps: [
            {
              targetSelector: '[data-tour="client-recompensas-points"]',
              title: "Seu Saldo de Pontos 🌟",
              description: "Acompanhe seus pontos acumulados a cada compra e participação em rifas.",
            },
            {
              targetSelector: '[data-tour="client-recompensas-catalog"]',
              title: "Catálogo de Prêmios & Cupons 🎁",
              description: "Troque seus pontos por cupons de desconto, frete grátis e miniaturas exclusivas grátis com resgate instantâneo!",
            },
          ],
        };
      }
      if (path === "/ranking") {
        return {
          key: "client-ranking",
          steps: [
            {
              targetSelector: '[data-tour="client-ranking-podium"]',
              title: "Pódio dos Top Colecionadores 🏆",
              description: "Confira quem são os 3 maiores colecionadores da loja e disputem o topo do pódio!",
            },
            {
              targetSelector: '[data-tour="client-ranking-table"]',
              title: "Classificação Geral & Selos VIP 🥇",
              description: "Acompanhe sua posição no ranking geral, número de miniaturas e ganhe selos exclusivos como 'Entusiasta', 'Ouro' e 'Lenda'!",
            },
          ],
        };
      }
    }
    return null;
  };

  const spotlightConfig = getSpotlightConfig();

  // Auto-open tour on first access per page
  useEffect(() => {
    const key = spotlightConfig ? `hw_tour_${spotlightConfig.key}` : (isAdminView ? "hw_tour_admin_completed" : "hw_tour_client_completed");
    const completed = localStorage.getItem(key);
    if (!completed) {
      const timer = setTimeout(() => {
        setTourOpen(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [path, isAdminView]);

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
    if (profile?.whatsapp) {
      setWhatsapp(formatPhone(profile.whatsapp));
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

  const { data: firstStore } = useQuery({
    queryKey: ["first-store-owner"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("owner_id, slug")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const isMasterAdmin =
    user?.email?.toLowerCase() === "gabrielribeirosoares@hotmail.com" ||
    user?.email?.toLowerCase() === "minishub01@gmail.com" ||
    user?.email?.toLowerCase().includes("triade") ||
    user?.email?.toLowerCase().includes("garagem") ||
    ownedStore?.slug === "garagem164" ||
    ownedStore?.slug === "gonzagaminis" ||
    (firstStore && firstStore.owner_id === user?.id);

  const adminNav = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/estoque", label: "Estoque", icon: Boxes },
    { to: "/admin/carros", label: "Adicionar Carro", icon: PlusCircle },
    { to: "/admin/garagens", label: "Garagens", icon: Car },
    { to: "/admin/recompensas", label: "Recompensas", icon: Package },
    { to: "/admin/resgates", label: "Resgates", icon: Gift },
    { to: "/admin/rifas", label: "Rifas", icon: Ticket },
    ...(isMasterAdmin ? [{ to: "/admin/assinaturas", label: "Gestão SaaS", icon: ShieldCheck }] : []),
  ];

  const nav = isAdminView ? adminNav : clientNav;

  const clientStores = (myStores ?? []).filter((s: any) => s.id !== ownedStore?.id);

  return (
    <div className="min-h-screen pb-24 md:pb-8 transition-colors duration-300" style={{ "--store-primary": primaryColor, "--primary": primaryColor, "--secondary": primaryColor, "--ring": primaryColor } as React.CSSProperties}>
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
                {clientStores.map((s: any) => (
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
                {clientStores.length === 0 && (
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
                {clientStores.length > 0 && (
                  <>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Lojas que sou cliente
                    </DropdownMenuLabel>
                    {clientStores.map((s: any) => (
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
                  <Button
                    variant={active ? "default" : "ghost"}
                    size="sm"
                    className="gap-2 font-bold transition-all"
                    style={active ? { background: primaryColor, color: "#ffffff" } : undefined}
                  >
                    <n.icon className="h-4 w-4" /> {n.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            {!isAdminView && activeStore && (
              <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-white font-bold text-sm" style={{ background: primaryColor }}>
                <Trophy className="h-4 w-4" />
                <span>{clientPoints ?? 0} pts</span>
              </div>
            )}

            {/* Selector de Tema (Diurno / Noturno / Computador) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Tema (Claro / Escuro / Automático)">
                  {theme === "light" ? (
                    <Sun className="h-4 w-4 text-amber-500" />
                  ) : theme === "dark" ? (
                    <Moon className="h-4 w-4 text-blue-400" />
                  ) : (
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Tema da Aplicação
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => setTheme("light")}
                  className={`cursor-pointer gap-2 ${theme === "light" ? "font-bold text-primary" : ""}`}
                >
                  <Sun className="h-4 w-4 text-amber-500" /> Tema Diurno (Claro)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("dark")}
                  className={`cursor-pointer gap-2 ${theme === "dark" ? "font-bold text-primary" : ""}`}
                >
                  <Moon className="h-4 w-4 text-blue-400" /> Tema Noturno (Escuro)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme("system")}
                  className={`cursor-pointer gap-2 ${theme === "system" ? "font-bold text-primary" : ""}`}
                >
                  <Monitor className="h-4 w-4 text-muted-foreground" /> Automático (do Computador)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTourOpen(true)}
              title="Guia Interativo • Como Funciona"
              className="text-primary hover:bg-primary/10"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>

            <Button onClick={() => setProfileOpen(true)} variant="ghost" size="icon" title="Meu Perfil">
              <UserIcon className="h-4 w-4" />
            </Button>
            <Button onClick={signOut} variant="ghost" size="icon" title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content view */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      {/* Reusable Footer Component */}
      <Footer />

      {/* Mobile nav bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur px-2 py-2 flex justify-around items-center">
        {nav.map((n) => {
          const active = path === n.to || (n.to !== "/admin" && path.startsWith(n.to));
          return (
            <Link key={n.to} to={n.to} className="flex flex-col items-center">
              <Button
                variant={active ? "default" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-xl transition-all"
                style={active ? { background: primaryColor, color: "#ffffff" } : undefined}
              >
                <n.icon className="h-4 w-4" />
              </Button>
              <span className={`text-[10px] font-bold mt-1 ${active ? "text-primary font-black" : "text-muted-foreground"}`}>
                {n.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground">Editar Meu Perfil</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.mutate({ name: fullName, wa: whatsapp });
            }}
            className="space-y-4 pt-4"
          >
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                required
                className="bg-background border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="text-sm font-bold text-muted-foreground uppercase tracking-wider">WhatsApp</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg pointer-events-none select-none z-10">
                  {getPhoneFlag(whatsapp)}
                </span>
                <Input
                  id="whatsapp"
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                  placeholder="Ex: (11) 99999-9999 ou +1 555 1234"
                  className="bg-background border-border text-foreground pl-11"
                />
              </div>
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

      {/* Onboarding / Spotlight Tour Component for First-time Access and Help */}
      {spotlightConfig ? (
        <SpotlightTour
          steps={spotlightConfig.steps}
          isOpen={tourOpen}
          onClose={() => setTourOpen(false)}
          tourKey={spotlightConfig.key}
        />
      ) : (
        <OnboardingTour
          isAdminView={isAdminView}
          isOpen={tourOpen}
          onClose={() => setTourOpen(false)}
        />
      )}
    </div>
  );
}