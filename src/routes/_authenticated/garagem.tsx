import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile } from "@/hooks/useAuth";
import { useActiveClientStore, useCustomerPoints } from "@/hooks/useStore";
import { Car, Trophy, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/garagem")({
  component: Garagem,
});

function Garagem() {
  const user = useSession();
  const { data: profile } = useProfile();
  const { data: store } = useActiveClientStore();
  const storeId = store?.id;
  const { data: pointsBalance } = useCustomerPoints(storeId);
  const qc = useQueryClient();

  const { data: cars, isLoading } = useQuery({
    queryKey: ["cars", user?.id, storeId],
    enabled: !!user && !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("user_id", user!.id)
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user || !storeId) return;
    const ch = supabase
      .channel(`cars-${user.id}-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cars", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["cars", user.id, storeId] });
        qc.invalidateQueries({ queryKey: ["customer-points", user.id, storeId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, storeId, qc]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border overflow-hidden relative">
        <div className="absolute inset-0 hw-gradient-orange opacity-90" />
        <div className="relative p-6 md:p-8 text-primary-foreground">
          <p className="text-xs font-bold uppercase tracking-widest opacity-90">Minha Garagem</p>
          <h1 className="mt-1 text-3xl md:text-4xl font-black">Olá, {profile?.full_name?.split(" ")[0] || "Colecionador"}!</h1>
          <div className="mt-4 flex items-center gap-6">
            <div>
              <div className="text-xs opacity-80 uppercase tracking-wide">Saldo de pontos</div>
              <div className="flex items-center gap-2 text-3xl md:text-4xl font-black">
                <Trophy className="h-7 w-7" /> {pointsBalance ?? 0}
              </div>
            </div>
            <div className="h-14 w-px bg-primary-foreground/30" />
            <div>
              <div className="text-xs opacity-80 uppercase tracking-wide">Carros</div>
              <div className="flex items-center gap-2 text-3xl md:text-4xl font-black">
                <Car className="h-7 w-7" /> {cars?.length ?? 0}
              </div>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : cars && cars.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {cars.map((c, i) => (
            <div
              key={c.id}
              className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/60 transition-all hover:-translate-y-1 hover:hw-glow-orange animate-in fade-in zoom-in-95"
              style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
            >
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                ) : (
                  <Car className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <div className="p-3 space-y-2">
                <div className="font-bold text-sm line-clamp-2 min-h-[2.5rem]">{c.name}</div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1 text-xs font-bold text-primary">
                    <Sparkles className="h-3 w-3" /> +{c.points} pts
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {/* Payment Status Badge */}
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      c.payment_status === "paid" 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>
                      {c.payment_status === "paid" ? "Pago" : "Aguardando Pagto"}
                    </span>

                    {/* Shipping Status Badge */}
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      c.shipping_status === "shipped" 
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                    }`}>
                      {c.shipping_status === "shipped" ? "Enviado" : "Pendente Envio"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center">
          <Car className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-bold text-lg">Sua garagem está vazia</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Compre uma miniatura na loja e o dono adicionará ela aqui.
          </p>
        </div>
      )}
    </div>
  );
}