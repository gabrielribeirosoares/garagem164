import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Store, ShieldCheck, Clock, CheckCircle2, XCircle, Search, Calendar, MessageCircle, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";

import { useSession } from "@/hooks/useAuth";
import { useOwnedStore } from "@/hooks/useStore";

export const Route = createFileRoute("/_authenticated/admin/assinaturas")({
  component: AdminAssinaturas,
});

export function AdminAssinaturas() {
  const user = useSession();
  const { data: ownedStore } = useOwnedStore();
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const isMasterAdmin =
    user?.email === "minishub01@gmail.com" ||
    user?.email?.toLowerCase().includes("triade") ||
    ownedStore?.slug === "garagem164" ||
    ownedStore?.slug === "gonzagaminis";

  // Fetch all stores with profile details of owner
  const { data: stores, isLoading } = useQuery({
    queryKey: ["admin-all-stores"],
    queryFn: async () => {
      const { data: storesData, error: storesError } = await supabase
        .from("stores")
        .select("*")
        .order("created_at", { ascending: false });

      if (storesError) throw storesError;

      // Fetch owner profile details
      const ownerIds = Array.from(new Set(storesData.map((s: any) => s.owner_id)));
      let profilesMap = new Map<string, { full_name: string; email: string; whatsapp: string }>();

      if (ownerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email, whatsapp")
          .in("id", ownerIds);

        (profilesData ?? []).forEach((p: any) => {
          profilesMap.set(p.id, {
            full_name: p.full_name || "Lojista",
            email: p.email || "",
            whatsapp: p.whatsapp || "",
          });
        });
      }

      return storesData.map((s: any) => {
        const owner = profilesMap.get(s.owner_id);
        const expiresAt = s.subscription_expires_at ? new Date(s.subscription_expires_at) : new Date(Date.now() + 7 * 86400000);
        const isExpired = expiresAt.getTime() < Date.now();
        const rawStatus = s.subscription_status || "trial";
        
        let calculatedStatus = rawStatus;
        if (rawStatus !== "blocked" && isExpired) {
          calculatedStatus = "past_due";
        }

        return {
          ...s,
          owner_name: owner?.full_name || "Sem nome",
          owner_email: owner?.email || "",
          owner_whatsapp: owner?.whatsapp || "",
          calculated_status: calculatedStatus,
          expires_date: expiresAt,
        };
      });
    },
  });

  // Mutation to update subscription status and expiration
  const updateSubscription = useMutation({
    mutationFn: async ({ storeId, daysToAdd, newStatus }: { storeId: string; daysToAdd?: number; newStatus: string }) => {
      let updatePayload: any = {
        subscription_status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (daysToAdd !== undefined) {
        const store = stores?.find((s) => s.id === storeId);
        const currentExp = store && store.expires_date.getTime() > Date.now() ? store.expires_date.getTime() : Date.now();
        const newExpDate = new Date(currentExp + daysToAdd * 86400000);
        updatePayload.subscription_expires_at = newExpDate.toISOString();
      }

      const { error } = await supabase
        .from("stores")
        .update(updatePayload)
        .eq("id", storeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assinatura atualizada com sucesso!");
      qc.invalidateQueries({ queryKey: ["admin-all-stores"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleRenew30Days = (store: any) => {
    updateSubscription.mutate({
      storeId: store.id,
      daysToAdd: 30,
      newStatus: "active",
    });
  };

  const handleGrant7DaysTrial = (store: any) => {
    updateSubscription.mutate({
      storeId: store.id,
      daysToAdd: 7,
      newStatus: "trial",
    });
  };

  const handleBlockStore = (store: any) => {
    if (confirm(`Deseja suspender/bloquear o acesso da loja "${store.name}"?`)) {
      updateSubscription.mutate({
        storeId: store.id,
        newStatus: "blocked",
      });
    }
  };

  const handleUnblockStore = (store: any) => {
    updateSubscription.mutate({
      storeId: store.id,
      newStatus: "active",
    });
  };

  const sendWhatsAppBillingNotice = (store: any) => {
    if (!store.owner_whatsapp) {
      toast.error("Lojista não possui WhatsApp cadastrado no perfil.");
      return;
    }
    const cleanPhone = store.owner_whatsapp.replace(/\D/g, "");
    const text = `Olá ${store.owner_name}! 🚗💨\n\nSua assinatura mensal da plataforma MinisHub referente à sua loja *${store.name}* está vencida.\n\nPara renovar por +30 dias e manter suas rifas e vitrine ativas, realize o pagamento do PIX de R$ 97,00 e envie o comprovante por aqui!\n\nChave PIX: minishub01@gmail.com`;
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const filteredStores = (stores ?? []).filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.owner_email.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "active") return matchesSearch && s.calculated_status === "active";
    if (activeTab === "trial") return matchesSearch && s.calculated_status === "trial";
    if (activeTab === "past_due") return matchesSearch && (s.calculated_status === "past_due" || s.calculated_status === "blocked");
    return matchesSearch;
  });

  if (!isMasterAdmin) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground bg-card max-w-lg mx-auto py-20 space-y-3">
        <ShieldCheck className="h-12 w-12 text-red-500/60 animate-pulse mx-auto" />
        <h3 className="font-bold text-white text-lg">Acesso Exclusivo do Administrador Master</h3>
        <p className="text-sm text-muted-foreground">Esta página de Gestão SaaS é de uso exclusivo do fundador/administrador master da plataforma.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> Painel Master SaaS — Gestão de Lojas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle manual de pagamentos PIX, renovações de 30 dias e liberação de período de teste.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <div className="text-xs text-muted-foreground font-bold uppercase">Total de Lojas</div>
          <div className="text-2xl font-black text-foreground">{stores?.length ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-4 space-y-1">
          <div className="text-xs text-green-400 font-bold uppercase">Ativas (Pagas)</div>
          <div className="text-2xl font-black text-green-400">
            {stores?.filter((s) => s.calculated_status === "active").length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-1">
          <div className="text-xs text-yellow-400 font-bold uppercase">Em Teste (Trial)</div>
          <div className="text-2xl font-black text-yellow-400">
            {stores?.filter((s) => s.calculated_status === "trial").length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 space-y-1">
          <div className="text-xs text-red-400 font-bold uppercase">Vencidas / Bloqueadas</div>
          <div className="text-2xl font-black text-red-400">
            {stores?.filter((s) => s.calculated_status === "past_due" || s.calculated_status === "blocked").length ?? 0}
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome da loja, slug, lojista ou e-mail..."
            className="pl-9 bg-background border-border text-foreground text-xs h-10 rounded-xl"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="all">Todas ({stores?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="active">Ativas</TabsTrigger>
            <TabsTrigger value="trial">Em Teste</TabsTrigger>
            <TabsTrigger value="past_due">Vencidas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stores List Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xl">
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
              Carregando lista de lojas parceiras...
            </div>
          ) : !filteredStores.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma loja encontrada nesta categoria.
            </div>
          ) : (
            filteredStores.map((store) => {
              const status = store.calculated_status;
              const formattedDate = store.expires_date.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              });

              return (
                <div key={store.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                  {/* Store Details */}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {store.logo_url ? (
                        <img src={store.logo_url} alt={store.name} className="h-7 w-7 rounded object-cover" />
                      ) : (
                        <Store className="h-5 w-5 text-primary" />
                      )}
                      <h3 className="font-black text-lg text-foreground">{store.name}</h3>
                      <a
                        href={`/${store.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary font-bold hover:underline flex items-center gap-1 font-mono bg-primary/10 px-2 py-0.5 rounded border border-primary/20"
                      >
                        /{store.slug} <ExternalLink className="h-3 w-3" />
                      </a>

                      {/* Status Badges */}
                      {status === "active" && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1 text-[10px] font-bold uppercase">
                          <CheckCircle2 className="h-3 w-3" /> Ativa (Paga)
                        </Badge>
                      )}
                      {status === "trial" && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1 text-[10px] font-bold uppercase">
                          <Clock className="h-3 w-3" /> Em Teste (7 dias)
                        </Badge>
                      )}
                      {status === "past_due" && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1 text-[10px] font-bold uppercase">
                          <AlertTriangle className="h-3 w-3" /> Mensalidade Vencida
                        </Badge>
                      )}
                      {status === "blocked" && (
                        <Badge variant="destructive" className="gap-1 text-[10px] font-bold uppercase">
                          <XCircle className="h-3 w-3" /> Loja Suspensa
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                      <span>Lojista: <strong className="text-foreground">{store.owner_name}</strong></span>
                      <span>•</span>
                      <span>E-mail: <strong className="text-foreground">{store.owner_email}</strong></span>
                      {store.owner_whatsapp && (
                        <>
                          <span>•</span>
                          <span>WhatsApp: <strong className="text-foreground">{store.owner_whatsapp}</strong></span>
                        </>
                      )}
                      <span>•</span>
                      <span className="flex items-center gap-1 text-muted-foreground font-semibold">
                        <Calendar className="h-3.5 w-3.5" /> Vence em: <span className="text-foreground font-bold">{formattedDate}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions for Master Admin */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0 pt-2 lg:pt-0">
                    <Button
                      size="sm"
                      onClick={() => handleRenew30Days(store)}
                      disabled={updateSubscription.isPending}
                      className="hw-gradient-orange text-white font-bold text-xs h-9 px-3"
                      title="Confirmar pagamento PIX e renovar por +30 dias"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Renovar +30 Dias (PIX)
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGrant7DaysTrial(store)}
                      disabled={updateSubscription.isPending}
                      className="border-border text-foreground hover:bg-muted font-bold text-xs h-9 px-3"
                      title="Conceder +7 dias de teste grátis"
                    >
                      <Clock className="h-3.5 w-3.5 mr-1.5 text-yellow-400" /> +7 Dias Teste
                    </Button>

                    {store.owner_whatsapp && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => sendWhatsAppBillingNotice(store)}
                        className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 font-bold text-xs h-9 px-3"
                        title="Enviar cobrança via WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Cobrar PIX
                      </Button>
                    )}

                    {status !== "blocked" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleBlockStore(store)}
                        disabled={updateSubscription.isPending}
                        className="text-destructive hover:bg-destructive/10 text-xs h-9 px-2"
                        title="Suspender acesso da loja"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Suspender
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnblockStore(store)}
                        disabled={updateSubscription.isPending}
                        className="border-green-500/40 text-green-400 hover:bg-green-500/10 text-xs h-9 px-2"
                        title="Desbloquear acesso da loja"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reativar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
