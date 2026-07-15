import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile } from "@/hooks/useAuth";
import { Car, Trophy, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/garagem")({
  component: Garagem,
});

function Garagem() {
  const user = useSession();
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const { data: cars, isLoading } = useQuery({
    queryKey: ["cars", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`cars-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cars", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["cars", user.id] });
        qc.invalidateQueries({ queryKey: ["profile", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

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
                <Trophy className="h-7 w-7" /> {profile?.points ?? 0}
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
              <div className="p-3">
                <div className="font-bold text-sm line-clamp-2 min-h-[2.5rem]">{c.name}</div>
                <div className="mt-2 flex items-center gap-1 text-xs font-bold text-primary">
                  <Sparkles className="h-3 w-3" /> +{c.points} pts
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