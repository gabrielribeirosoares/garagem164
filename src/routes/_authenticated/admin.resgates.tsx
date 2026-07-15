import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Gift, CheckCircle2, Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/resgates")({
  component: AdminRedemptions,
});

function AdminRedemptions() {
  const qc = useQueryClient();

  const { data: redemptions } = useQuery({
    queryKey: ["admin-redemptions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("redemptions")
        .select("*, profiles:profiles!redemptions_user_id_fkey(full_name,email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-resgates")
      .on("postgres_changes", { event: "*", schema: "public", table: "redemptions" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-redemptions-all"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "completed" | "cancelled" }) => {
      const { error } = await supabase.from("redemptions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.status === "completed" ? "Marcado como entregue" : "Resgate cancelado — pontos devolvidos");
      qc.invalidateQueries({ queryKey: ["admin-redemptions-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const byStatus = (s: string) => redemptions?.filter((r) => r.status === s) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
        <Gift className="h-7 w-7 text-primary" /> Aprovação de Resgates
      </h1>

      <Tabs defaultValue="pending">
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
                    <div className="font-bold text-sm">{r.reward_title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.profiles?.full_name || r.profiles?.email} · {r.cost} pts · {new Date(r.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Badge variant={r.status === "completed" ? "default" : r.status === "cancelled" ? "destructive" : "secondary"} className="gap-1">
                    {r.status === "pending" && <><Clock className="h-3 w-3" />Pendente</>}
                    {r.status === "completed" && <><CheckCircle2 className="h-3 w-3" />Entregue</>}
                    {r.status === "cancelled" && <><XCircle className="h-3 w-3" />Cancelado</>}
                  </Badge>
                  {r.status === "pending" && (
                    <div className="flex gap-2 w-full sm:w-auto">
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