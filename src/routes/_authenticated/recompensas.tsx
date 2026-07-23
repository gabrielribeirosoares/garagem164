import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { useActiveClientStore, useCustomerPoints } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Ticket, Truck, Star, Gift, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/recompensas")({
  component: RecompensasPage,
});

const CATEGORY_META = {
  coupon: { label: "Cupons de Desconto", icon: Ticket, gradient: "hw-gradient-orange" },
  shipping: { label: "Frete Grátis", icon: Truck, gradient: "hw-gradient-blue" },
  miniature: { label: "Miniaturas Exclusivas", icon: Star, gradient: "hw-gradient-orange" },
} as const;

type Category = keyof typeof CATEGORY_META;

function RecompensasPage() {
  const user = useSession();
  const { data: store } = useActiveClientStore();
  const storeId = store?.id;
  const { data: pointsBalance } = useCustomerPoints(storeId);
  const qc = useQueryClient();
  const [activeRedemptionCode, setActiveRedemptionCode] = useState<{ code: string; title: string; cost: number } | null>(null);

  const { data: rewards } = useQuery({
    queryKey: ["rewards", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("rewards").select("*").eq("store_id", storeId!).eq("active", true).order("cost");
      if (error) throw error;
      return data;
    },
  });

  const { data: myRedemptions } = useQuery({
    queryKey: ["my-redemptions", user?.id, storeId],
    enabled: !!user && !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("redemptions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const redeem = useMutation({
    mutationFn: async (reward: { id: string; title: string; category: Category; cost: number }) => {
      if (!storeId) throw new Error("Loja não encontrada.");
      const { data, error } = await supabase
        .from("redemptions")
        .insert({
          store_id: storeId,
          user_id: user!.id,
          reward_id: reward.id,
          reward_title: reward.title,
          reward_category: reward.category,
          cost: reward.cost,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      const code = "GM-" + data.id.split("-")[0].toUpperCase();
      setActiveRedemptionCode({ code, title: variables.title, cost: variables.cost });
      toast.success("Resgate solicitado com sucesso!");
      qc.invalidateQueries({ queryKey: ["my-redemptions", user?.id, storeId] });
      qc.invalidateQueries({ queryKey: ["customer-points", user?.id, storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const points = pointsBalance ?? 0;
  const grouped = (cat: Category) => rewards?.filter((r) => r.category === cat) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border p-6 bg-card flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-black">Central de Recompensas</h1>
          <p className="text-sm text-muted-foreground mt-1">Troque seus pontos por benefícios exclusivos.</p>
        </div>
        <div className="rounded-full hw-gradient-orange px-4 py-2 text-primary-foreground font-black text-lg hw-glow-orange flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> {points} pts
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catálogo</TabsTrigger>
          <TabsTrigger value="mine">Meus resgates</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-6 mt-6">
          {!rewards?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum benefício disponível no catálogo.</p>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              {rewards.map((r) => {
                const canRedeem = points >= r.cost;
                const meta = CATEGORY_META[r.category as Category] || CATEGORY_META.coupon;
                return (
                  <div key={r.id} className="rounded-2xl border border-border bg-card overflow-hidden group hover:border-primary/60 transition-all flex flex-col justify-between">
                    <div>
                      <div className="h-32 bg-[#141414] border-b border-border/30 relative flex items-center justify-center overflow-hidden">
                        {r.image_url ? (
                          <img src={r.image_url} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <meta.icon className="h-12 w-12 text-muted-foreground/45" />
                        )}
                        
                        {/* Category Badge */}
                        <div className="absolute top-2 left-2">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider text-white shadow-md ${
                            r.category === 'coupon' 
                              ? 'bg-[#ea580c]' 
                              : r.category === 'shipping'
                                ? 'bg-[#2563eb]'
                                : 'bg-[#eab308] text-black'
                          }`}>
                            {r.category === 'coupon' ? 'Cupom' : r.category === 'shipping' ? 'Frete' : 'Miniatura'}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div>
                          <h3 className="font-bold text-foreground text-base">{r.title}</h3>
                          {r.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 pt-0 flex items-center justify-between mt-auto">
                      <div className="font-black text-primary flex items-center gap-1">
                        <Sparkles className="h-4 w-4" /> {r.cost} pts
                      </div>
                      <Button
                        size="sm"
                        disabled={!canRedeem || redeem.isPending}
                        onClick={() => redeem.mutate({ id: r.id, title: r.title, category: r.category as Category, cost: r.cost })}
                        className={canRedeem ? "hw-gradient-orange text-primary-foreground font-bold" : ""}
                      >
                        {canRedeem ? "Resgatar" : "Sem pontos"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-6 space-y-3">
          {!myRedemptions?.length ? (
            <p className="text-sm text-muted-foreground">Você ainda não fez nenhum resgate.</p>
          ) : (
            myRedemptions.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Gift className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{r.reward_title}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-2 items-center mt-0.5">
                      <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                      <span>·</span>
                      <span>{r.cost} pts</span>
                      <span>·</span>
                      <span className="bg-muted border border-border px-1.5 py-0.5 rounded font-mono text-[10px] text-foreground font-bold">
                        Código: {"GM-" + r.id.split("-")[0].toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge variant={r.status === "completed" ? "default" : r.status === "cancelled" ? "destructive" : "secondary"} className="gap-1">
                  {r.status === "pending" && <><Clock className="h-3 w-3" /> Pendente</>}
                  {r.status === "completed" && <><CheckCircle2 className="h-3 w-3" /> Concluído</>}
                  {r.status === "cancelled" && "Cancelado"}
                </Badge>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {activeRedemptionCode && (
        <Dialog open={!!activeRedemptionCode} onOpenChange={(open) => { if (!open) setActiveRedemptionCode(null); }}>
          <DialogContent className="max-w-md bg-card border-border text-foreground">
            <DialogHeader className="space-y-3 text-center sm:text-left">
              <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                Resgate Confirmado!
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Sua solicitação de resgate foi registrada. Apresente o código abaixo ao lojista para retirar sua recompensa.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 flex flex-col items-center justify-center bg-background border border-border rounded-2xl my-4 space-y-2">
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">CÓDIGO DE RESGATE</span>
              <span className="text-3xl font-black text-foreground tracking-widest font-mono select-all">
                {activeRedemptionCode.code}
              </span>
              <span className="text-[10px] text-muted-foreground/80 mt-1 uppercase tracking-wider text-center px-4">
                {activeRedemptionCode.title} · {activeRedemptionCode.cost} pts
              </span>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-bold text-white">⚠️ Importante:</p>
              <p>• Esse código é de uso único e será invalidado após a confirmação do lojista.</p>
              <p>• Você pode acessar esse código a qualquer momento na aba &quot;Meus resgates&quot;.</p>
            </div>

            <DialogFooter className="mt-4">
              <Button onClick={() => setActiveRedemptionCode(null)} className="w-full bg-primary hover:bg-primary/90 text-white font-bold">
                Entendido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}