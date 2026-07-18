import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Users, Gift, Clock, Trophy, Sparkles, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useOwnedStore } from "@/hooks/useStore";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const qc = useQueryClient();
  const { data: store } = useOwnedStore();
  const storeId = store?.id;

  const [customerSearch, setCustomerSearch] = useState("");

  const { data: customers } = useQuery({
    queryKey: ["admin-customers", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_customers", {
        _store_id: storeId!,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.user_id,
        full_name: r.full_name,
        email: r.email,
        points: r.points,
        whatsapp: r.whatsapp,
      }));
    },
  });

  const { data: redemptions } = useQuery({
    queryKey: ["admin-redemptions", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("redemptions")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    if (!storeId) return;
    const ch = supabase
      .channel(`admin-redemptions-${storeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "redemptions", filter: `store_id=eq.${storeId}` }, (payload) => {
        const row: any = payload.new;
        toast.success(`Novo resgate: ${row.reward_title}`, { description: `${row.cost} pontos` });
        qc.invalidateQueries({ queryKey: ["admin-redemptions", storeId] });
        qc.invalidateQueries({ queryKey: ["admin-customers", storeId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "redemptions", filter: `store_id=eq.${storeId}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-redemptions", storeId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, storeId]);

  const pending = redemptions?.filter((r) => r.status === "pending") ?? [];
  const totalPoints = customers?.reduce((s, c) => s + (c.points ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-secondary font-bold">Painel do Lojista</p>
          <h1 className="text-3xl md:text-4xl font-black">Dashboard</h1>
        </div>
        {store && (
          <Button
            className="hw-gradient-orange text-white font-bold h-9"
            onClick={() => {
              const link = `${window.location.origin}/${store.slug}`;
              navigator.clipboard.writeText(link);
              toast.success("Link de convite copiado!");
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" /> Copiar Link de Convite
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat icon={Users} label="Clientes" value={customers?.length ?? 0} />
        <Stat icon={Bell} label="Resgates pendentes" value={pending.length} highlight />
        <Stat icon={Trophy} label="Pontos em circulação" value={totalPoints} />
      </div>

      <section className="rounded-3xl border border-border bg-card overflow-hidden">
        <header className="p-5 border-b border-border flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-black">Central de Alertas</h2>
          {pending.length > 0 && <Badge className="hw-gradient-orange text-primary-foreground">{pending.length} novos</Badge>}
        </header>
        <div className="divide-y divide-border">
          {pending.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Sem resgates pendentes no momento.</div>
          ) : (
            pending.map((r) => (
              <div key={r.id} className="p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                <div className="h-10 w-10 rounded-lg hw-gradient-orange flex items-center justify-center text-primary-foreground">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{r.reward_title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {(() => { const c = customers?.find(c => c.id === r.user_id); return c?.full_name || c?.email || "Cliente"; })()} · {r.cost} pts · {new Date(r.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card overflow-hidden">
        <header className="p-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-secondary" />
            <h2 className="font-black">Clientes</h2>
          </div>
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisar por nome, email ou whatsapp..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full bg-[#121212] border border-border text-foreground h-9 pl-9 pr-4 rounded-xl text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        </header>
        <div className="divide-y divide-border">
          {(customers ?? [])
            .filter((c) => {
              const q = customerSearch.toLowerCase().trim();
              if (!q) return true;
              return (
                (c.full_name && c.full_name.toLowerCase().includes(q)) ||
                (c.email && c.email.toLowerCase().includes(q)) ||
                (c.whatsapp && c.whatsapp.toLowerCase().includes(q))
              );
            })
            .map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{c.full_name || "Sem nome"}</div>
                  <div className="text-xs text-muted-foreground truncate flex flex-col gap-0.5">
                    <span>{c.email}</span>
                    {c.whatsapp && <span className="text-secondary font-semibold">WhatsApp: {c.whatsapp}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-bold text-primary">
                  <Sparkles className="h-3 w-3" /> {c.points} pts
                </div>
              </div>
            ))}
          {(!customers ||
            customers.filter((c) => {
              const q = customerSearch.toLowerCase().trim();
              if (!q) return true;
              return (
                (c.full_name && c.full_name.toLowerCase().includes(q)) ||
                (c.email && c.email.toLowerCase().includes(q)) ||
                (c.whatsapp && c.whatsapp.toLowerCase().includes(q))
              );
            }).length === 0) && (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Nenhum cliente encontrado.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight ? "border-primary/50 hw-glow-orange" : "border-border"} bg-card`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}