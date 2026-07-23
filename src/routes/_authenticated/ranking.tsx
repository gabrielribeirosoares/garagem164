import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { useActiveClientStore } from "@/hooks/useStore";
import { Badge } from "@/components/ui/badge";
import { Trophy, Car, Sparkles, Medal, Award, Flame, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: ClientRanking,
});

function ClientRanking() {
  const user = useSession();
  const { data: activeStore } = useActiveClientStore();

  const { data: customers } = useQuery({
    queryKey: ["ranking-customers", activeStore?.id],
    enabled: !!activeStore?.id,
    queryFn: async () => {
      // Get all customer points rows for active store
      const { data: cpData, error: cpError } = await supabase
        .from("customer_points")
        .select("user_id, points, profiles(full_name, email)")
        .eq("store_id", activeStore!.id);

      if (cpError) throw cpError;

      // Also get car counts per user in active store
      const { data: carData, error: carError } = await supabase
        .from("cars")
        .select("user_id, id")
        .eq("store_id", activeStore!.id);

      if (carError) throw carError;

      const carCountMap = new Map<string, number>();
      carData.forEach((c) => {
        carCountMap.set(c.user_id, (carCountMap.get(c.user_id) || 0) + 1);
      });

      return (cpData ?? [])
        .map((row: any) => ({
          user_id: row.user_id,
          full_name: row.profiles?.full_name || row.profiles?.email?.split("@")[0] || "Colecionador",
          email: row.profiles?.email || "",
          points: row.points || 0,
          car_count: carCountMap.get(row.user_id) || 0,
        }))
        .sort((a, b) => b.car_count - a.car_count || b.points - a.points);
    },
  });

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center max-w-md mx-auto">
        <Trophy className="h-12 w-12 text-muted-foreground animate-pulse" />
        <h3 className="font-bold text-lg text-white">Nenhuma loja ativa</h3>
        <p className="text-sm text-muted-foreground">
          Por favor, selecione uma loja no cabeçalho superior para ver o ranking de colecionadores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
          <Trophy className="h-7 w-7 text-yellow-500 animate-bounce" /> Ranking de Colecionadores
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Confira quem são os maiores colecionadores da <strong className="text-foreground">{activeStore.name}</strong>!
        </p>
      </div>

      {/* Top 3 Winners Podium */}
      {customers && customers.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 md:gap-6 items-end pt-6 pb-2">
          {/* 2nd Place */}
          <div className="bg-card border border-border rounded-3xl p-4 md:p-6 text-center space-y-2 order-1 shadow-lg">
            <div className="h-12 w-12 rounded-full bg-zinc-400/10 text-zinc-300 flex items-center justify-center mx-auto border border-zinc-400/30">
              <Medal className="h-6 w-6" />
            </div>
            <div className="text-xs uppercase font-bold text-zinc-400">2º Lugar</div>
            <div className="font-black text-sm md:text-base text-foreground truncate">{customers[1].full_name}</div>
            <div className="flex items-center justify-center gap-2 text-xs">
              <span className="font-bold text-primary flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {customers[1].car_count}</span>
              <span className="text-muted-foreground font-semibold">· {customers[1].points} pts</span>
            </div>
          </div>

          {/* 1st Place (Center Big) */}
          <div className="bg-card border-2 border-yellow-500/50 rounded-3xl p-5 md:p-8 text-center space-y-3 order-2 shadow-2xl hw-glow-orange transform -translate-y-2">
            <div className="h-16 w-16 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center mx-auto border-2 border-yellow-500/50">
              <Trophy className="h-8 w-8 animate-pulse" />
            </div>
            <Badge className="bg-yellow-500 text-black font-black uppercase text-[10px] tracking-wider px-3">1º Lugar</Badge>
            <div className="font-black text-base md:text-xl text-foreground truncate">{customers[0].full_name}</div>
            <div className="flex items-center justify-center gap-3 text-xs md:text-sm">
              <span className="font-black text-primary flex items-center gap-1"><Car className="h-4 w-4" /> {customers[0].car_count} miniaturas</span>
              <span className="text-secondary font-bold">· {customers[0].points} pts</span>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="bg-card border border-border rounded-3xl p-4 md:p-6 text-center space-y-2 order-3 shadow-lg">
            <div className="h-12 w-12 rounded-full bg-amber-700/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-700/30">
              <Award className="h-6 w-6" />
            </div>
            <div className="text-xs uppercase font-bold text-amber-600">3º Lugar</div>
            <div className="font-black text-sm md:text-base text-foreground truncate">{customers[2].full_name}</div>
            <div className="flex items-center justify-center gap-2 text-xs">
              <span className="font-bold text-primary flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {customers[2].car_count}</span>
              <span className="text-muted-foreground font-semibold">· {customers[2].points} pts</span>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xl">
        <div className="p-5 border-b border-border bg-muted/10 flex items-center justify-between">
          <h2 className="font-black text-foreground text-base">Classificação Geral</h2>
          <span className="text-xs text-muted-foreground">{customers?.length ?? 0} colecionadores cadastrados</span>
        </div>

        <div className="divide-y divide-border">
          {!customers?.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum colecionador encontrado.</div>
          ) : (
            customers.map((c, index) => {
              const position = index + 1;
              const isMe = c.user_id === user?.id;

              let badgeText = "Iniciante";
              let badgeStyle = "bg-zinc-800 text-zinc-400";
              if (c.car_count >= 50) {
                badgeText = "💎 Lenda";
                badgeStyle = "bg-purple-500/20 text-purple-400 border-purple-500/30";
              } else if (c.car_count >= 30) {
                badgeText = "🥇 Ouro";
                badgeStyle = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
              } else if (c.car_count >= 10) {
                badgeText = "🥈 Entusiasta";
                badgeStyle = "bg-blue-500/20 text-blue-400 border-blue-500/30";
              }

              return (
                <div
                  key={c.user_id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    isMe ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-muted/10"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 bg-muted border border-border text-foreground">
                      {position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : `#${position}`}
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-sm text-foreground truncate flex items-center gap-2">
                        <span>{c.full_name}</span>
                        {isMe && <Badge className="bg-primary text-white font-black text-[9px] px-1.5 py-0">Você</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${badgeStyle}`}>
                          {badgeText}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right shrink-0">
                    <div>
                      <div className="font-black text-sm text-foreground flex items-center justify-end gap-1">
                        <Car className="h-3.5 w-3.5 text-primary" /> {c.car_count}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">miniaturas</div>
                    </div>
                    <div>
                      <div className="font-black text-sm text-secondary flex items-center justify-end gap-1">
                        <Sparkles className="h-3.5 w-3.5" /> {c.points}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">pontos</div>
                    </div>
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
