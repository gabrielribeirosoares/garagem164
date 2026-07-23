import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Gift, CheckCircle2, Clock, XCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useOwnedStore } from "@/hooks/useStore";

export const Route = createFileRoute("/_authenticated/admin/resgates")({
  component: AdminRedemptions,
});

function AdminRedemptions() {
  const qc = useQueryClient();
  const { data: store } = useOwnedStore();
  const storeId = store?.id;
  const [searchQuery, setSearchQuery] = useState("");

  const { data: redemptions } = useQuery({
    queryKey: ["admin-redemptions-all", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data: redemptionsData, error: redemptionsError } = await supabase
        .from("redemptions")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      
      if (redemptionsError) throw redemptionsError;
      if (!redemptionsData || redemptionsData.length === 0) return [];

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id,full_name,email,whatsapp");
      
      if (profilesError) throw profilesError;

      const profileMap = new Map(profilesData.map(p => [p.id, p]));
      return redemptionsData.map(r => ({
        ...r,
        profiles: profileMap.get(r.user_id) || null
      })) as any[];
    },
  });

  useEffect(() => {
    if (!storeId) return;
    const ch = supabase
      .channel(`admin-resgates-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "redemptions", filter: `store_id=eq.${storeId}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-redemptions-all", storeId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, storeId]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "completed" | "cancelled" }) => {
      const { error } = await supabase.from("redemptions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.status === "completed" ? "Marcado como entregue" : "Resgate cancelado — pontos devolvidos");
      qc.invalidateQueries({ queryKey: ["admin-redemptions-all", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const byStatus = (s: string) => {
    let list = redemptions?.filter((r) => r.status === s) ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const code = ("GM-" + r.id.split("-")[0]).toLowerCase();
        return (
          code.includes(q) ||
          r.reward_title.toLowerCase().includes(q) ||
          (r.profiles?.full_name && r.profiles.full_name.toLowerCase().includes(q)) ||
          (r.profiles?.email && r.profiles.email.toLowerCase().includes(q)) ||
          (r.profiles?.whatsapp && r.profiles.whatsapp.toLowerCase().includes(q))
        );
      });
    }
    return list;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
        <Gift className="h-7 w-7 text-primary" /> Aprovação de Resgates
      </h1>

      <div data-tour="admin-resgates-search" className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por código (ex: GM-A1B2C3D4) ou cliente..."
          className="pl-10 bg-background border-border text-foreground focus-visible:ring-1 focus-visible:ring-primary rounded-lg"
        />
      </div>

      <Tabs data-tour="admin-resgates-list" defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendentes ({byStatus("pending").length})</TabsTrigger>
          <TabsTrigger value="completed">Concluídos</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
        </TabsList>

        {(["pending", "completed", "cancelled"] as const).map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            <div className="rounded-3xl border border-border bg-card divide-y divide-border overflow-hidden">
              {byStatus(s).length === 0 && <div className="p-6 text-sm text-muted-foreground">Nada por aqui.</div>}
              {byStatus(s).map((r) => (
                <div key={r.id} className="p-4 flex items-center gap-3 flex-wrap">
                  <div className="h-11 w-11 rounded-lg hw-gradient-orange flex items-center justify-center text-primary-foreground shrink-0">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                      <span>{r.reward_title}</span>
                      <span className="bg-muted border border-border px-2 py-0.5 rounded font-mono text-[11px] text-foreground font-black">
                        {"GM-" + r.id.split("-")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.profiles?.full_name || r.profiles?.email} · {r.cost} pts · {new Date(r.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Badge variant={r.status === "completed" ? "default" : r.status === "cancelled" ? "destructive" : "secondary"} className="gap-1">
                    {r.status === "pending" && <><Clock className="h-3 w-3" />Pendente</>}
                    {r.status === "completed" && <><CheckCircle2 className="h-3 w-3" />Entregue</>}
                    {r.status === "cancelled" && <><XCircle className="h-3 w-3" />Cancelado</>}
                  </Badge>
                  {r.status === "pending" && (
                    <div data-tour="admin-resgates-actions" className="flex gap-2 w-full sm:w-auto">
                      <Button size="sm" onClick={() => setStatus.mutate({ id: r.id, status: "completed" })} className="hw-gradient-orange text-primary-foreground font-bold">
                        Marcar entregue
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "cancelled" })}>
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}