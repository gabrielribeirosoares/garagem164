import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile } from "@/hooks/useAuth";
import { useActiveClientStore, useCustomerPoints } from "@/hooks/useStore";
import { Car, Trophy, Sparkles, Share2, Copy, Users, MessageSquare, Award, ShieldCheck, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

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

  const [shareOpen, setShareOpen] = useState(false);

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

  const carCount = cars?.length ?? 0;

  // VIP Tier calculation
  let vipTier = "Bronze";
  let vipColor = "bg-amber-800/30 text-amber-400 border-amber-800/50";
  if (carCount >= 30) {
    vipTier = "Ouro VIP";
    vipColor = "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 font-black";
  } else if (carCount >= 10) {
    vipTier = "Prata VIP";
    vipColor = "bg-blue-500/20 text-blue-400 border-blue-500/40";
  }

  // Badges array
  const badges = [
    { title: "Iniciante", req: 1, unlocked: carCount >= 1, icon: "🥉" },
    { title: "Entusiasta", req: 10, unlocked: carCount >= 10, icon: "🥈" },
    { title: "Colecionador Ouro", req: 30, unlocked: carCount >= 30, icon: "🥇" },
    { title: "Lenda Hot Wheels", req: 50, unlocked: carCount >= 50, icon: "💎" },
  ];

  // Referral link
  const referralLink = typeof window !== "undefined" && store?.slug && user?.id
    ? `${window.location.origin}/${store.slug}/login?ref=${user.id}`
    : "";

  const copyReferralLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    toast.success("Link de indicação copiado com sucesso!");
  };

  const handleShareWhatsAppReferral = () => {
    const text = `Olá! Venha criar sua garagem de miniaturas na loja "${store?.name || "MinisHub"}" e ganhe pontos no seu cadastro! Use meu link exclusivo:\n\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareText = `🚗 Minha Garagem na ${store?.name || "MinisHub"}:\n• ${carCount} miniaturas na coleção\n• ${pointsBalance ?? 0} pontos acumulados\n• Nível: ${vipTier}\n\nVenha conhecer minha coleção!`;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <section className="rounded-3xl border border-border overflow-hidden relative shadow-2xl">
        <div className="absolute inset-0 hw-gradient-orange opacity-90" />
        <div className="relative p-6 md:p-8 text-primary-foreground space-y-6">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-widest opacity-90">Minha Garagem</p>
                <Badge variant="outline" className={`text-[10px] uppercase ${vipColor}`}>
                  {vipTier}
                </Badge>
              </div>
              <h1 className="mt-1 text-3xl md:text-4xl font-black">Olá, {profile?.full_name?.split(" ")[0] || "Colecionador"}!</h1>
            </div>

            <Button
              onClick={() => setShareOpen(true)}
              variant="secondary"
              size="sm"
              className="bg-black/40 hover:bg-black/60 text-white border border-white/20 font-bold text-xs"
            >
              <Share2 className="h-4 w-4 mr-2 text-primary" /> Compartilhar Garagem
            </Button>
          </div>

          <div className="flex items-center gap-6">
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
                <Car className="h-7 w-7" /> {carCount}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Badges Bar */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-black text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Conquistas de Colecionador
          </h2>
          <span className="text-xs text-muted-foreground">{badges.filter(b => b.unlocked).length} de {badges.length} desbloqueadas</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {badges.map((b) => (
            <div
              key={b.title}
              className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                b.unlocked
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-muted/20 text-muted-foreground opacity-50"
              }`}
            >
              <span className="text-2xl">{b.icon}</span>
              <div>
                <div className="font-bold text-xs text-foreground">{b.title}</div>
                <div className="text-[10px] text-muted-foreground">{b.req} miniaturas</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Referral Card ("Indique e Ganhe") */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl hw-gradient-orange flex items-center justify-center text-white shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-black text-foreground text-base">Indique um Amigo e Ganhe Pontos!</h3>
            <p className="text-xs text-muted-foreground">
              Compartilhe seu link exclusivo. Quando seus amigos entrarem na loja, vocês acumulam bônus na garagem.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="flex-1 bg-muted/40 border border-border rounded-xl text-xs px-3 h-10 text-foreground font-mono"
          />
          <div className="flex gap-2">
            <Button onClick={copyReferralLink} variant="secondary" className="h-10 text-xs px-3 border border-border font-bold">
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
            </Button>
            <Button onClick={handleShareWhatsAppReferral} className="hw-gradient-orange text-white font-bold h-10 text-xs px-4">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
            </Button>
          </div>
        </div>
      </section>

      {/* Cars Grid Header */}
      <div className="flex justify-between items-center pt-2">
        <h2 className="font-black text-lg text-foreground">Minhas Miniaturas</h2>
        <span className="text-xs text-muted-foreground">{carCount} itens</span>
      </div>

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
            Compre uma miniatura na vitrine e o dono adicionará ela aqui.
          </p>
          <div className="mt-4">
            <Link to="/loja">
              <Button size="sm" className="hw-gradient-orange text-white font-bold">
                Ver Vitrine de Miniaturas
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Dialog: Instagram / Social Share Garage Card */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-[420px] bg-[#0c0c0c] border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-center font-black text-xl text-white">Card da Minha Garagem</DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Compartilhe seu status de colecionador nas redes sociais ou WhatsApp!
            </DialogDescription>
          </DialogHeader>

          {/* Card Preview */}
          <div className="p-6 rounded-3xl border border-primary/40 bg-gradient-to-b from-[#181818] to-[#0d0d0d] space-y-6 hw-glow-orange text-center relative overflow-hidden">
            <div className="flex flex-col items-center space-y-1">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{store?.name || "MinisHub"}</span>
              <h3 className="font-black text-2xl text-white">{profile?.full_name || "Colecionador"}</h3>
              <Badge className={`text-[10px] ${vipColor}`}>{vipTier}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 border-y border-border/60 py-4">
              <div>
                <div className="text-2xl font-black text-primary flex items-center justify-center gap-1">
                  <Car className="h-5 w-5" /> {carCount}
                </div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Miniaturas</div>
              </div>
              <div>
                <div className="text-2xl font-black text-secondary flex items-center justify-center gap-1">
                  <Trophy className="h-5 w-5" /> {pointsBalance ?? 0}
                </div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Pontos</div>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground font-mono">
              {store?.slug ? `site.com/${store.slug}` : "Coleção de Miniaturas"}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(shareText);
                toast.success("Texto copiado para compartilhar!");
              }}
              variant="secondary"
              className="border border-border font-bold text-xs h-10"
            >
              <Copy className="h-3.5 w-3.5 mr-2" /> Copiar Resumo para Redes Sociais
            </Button>
            <Button
              onClick={() => {
                window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
              }}
              className="hw-gradient-orange text-white font-bold text-xs h-10"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-2" /> Enviar no WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}