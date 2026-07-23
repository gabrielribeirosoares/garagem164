import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useProfile } from "@/hooks/useAuth";
import { useActiveClientStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Ticket, Sparkles, Copy, MessageSquare, Info, Trophy, Calendar, CheckCircle2, X, Image as ImageIcon, ExternalLink, ZoomIn, Flame, Zap, Dices, Clock, Truck, Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rifas")({
  component: ClientRifas,
});

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(targetDate).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;

  return (
    <div className="bg-gradient-to-r from-yellow-500/10 via-primary/10 to-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-yellow-400">
        <Clock className="h-4 w-4 animate-spin text-primary shrink-0" /> Sorteio em Encerramento
      </div>
      <div className="flex gap-2 text-center font-mono">
        <div className="bg-black/60 border border-border px-2.5 py-1 rounded-xl">
          <span className="text-base font-black text-white">{String(timeLeft.days).padStart(2, "0")}</span>
          <span className="text-[9px] block text-muted-foreground uppercase font-sans">dias</span>
        </div>
        <div className="bg-black/60 border border-border px-2.5 py-1 rounded-xl">
          <span className="text-base font-black text-white">{String(timeLeft.hours).padStart(2, "0")}</span>
          <span className="text-[9px] block text-muted-foreground uppercase font-sans">horas</span>
        </div>
        <div className="bg-black/60 border border-border px-2.5 py-1 rounded-xl">
          <span className="text-base font-black text-white">{String(timeLeft.minutes).padStart(2, "0")}</span>
          <span className="text-[9px] block text-muted-foreground uppercase font-sans">min</span>
        </div>
        <div className="bg-black/60 border border-border px-2.5 py-1 rounded-xl">
          <span className="text-base font-black text-primary">{String(timeLeft.seconds).padStart(2, "0")}</span>
          <span className="text-[9px] block text-muted-foreground uppercase font-sans">seg</span>
        </div>
      </div>
    </div>
  );
}

function ClientRifas() {
  const user = useSession();
  const { data: activeStore } = useActiveClientStore();
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [clientTab, setClientTab] = useState<"active" | "hall_of_fame">("active");

  // Fetch active store owner's whatsapp for copy PIX contact
  const { data: ownerProfile } = useQuery({
    queryKey: ["store-owner-profile", activeStore?.owner_id],
    enabled: !!activeStore?.owner_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("whatsapp, full_name")
        .eq("id", activeStore!.owner_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch raffles for active store
  const { data: raffles } = useQuery({
    queryKey: ["store-raffles", activeStore?.id],
    enabled: !!activeStore?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raffles")
        .select("*")
        .eq("store_id", activeStore!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedRaffle = raffles?.find((r) => r.id === selectedRaffleId);

  // Fetch tickets for selected raffle
  const { data: tickets } = useQuery({
    queryKey: ["raffle-tickets", selectedRaffleId],
    enabled: !!selectedRaffleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raffle_tickets")
        .select("*, profiles(full_name, email)")
        .eq("raffle_id", selectedRaffleId!);
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for raffle tickets
  useEffect(() => {
    if (!selectedRaffleId) return;
    const ch = supabase
      .channel(`raffle-tickets-realtime-${selectedRaffleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "raffle_tickets", filter: `raffle_id=eq.${selectedRaffleId}` }, () => {
        qc.invalidateQueries({ queryKey: ["raffle-tickets", selectedRaffleId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "raffles", filter: `id=eq.${selectedRaffleId}` }, () => {
        qc.invalidateQueries({ queryKey: ["store-raffles", activeStore?.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [selectedRaffleId, activeStore?.id, qc]);

  // Set first raffle as active by default if none selected
  useEffect(() => {
    if (raffles && raffles.length > 0 && !selectedRaffleId) {
      setSelectedRaffleId(raffles[0].id);
    }
  }, [raffles, selectedRaffleId]);

  // Mutations
  const reserveTicket = useMutation({
    mutationFn: async (number: number) => {
      if (!user) throw new Error("Você precisa estar logado.");
      const { error } = await supabase.from("raffle_tickets").insert({
        raffle_id: selectedRaffleId!,
        number,
        participant_name: profile?.full_name || profile?.email || "Cliente",
        user_id: user.id,
        status: "reserved",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Número reservado! Efetue o pagamento PIX para confirmar.");
      qc.invalidateQueries({ queryKey: ["raffle-tickets", selectedRaffleId] });
    },
    onError: (e: any) => {
      toast.error(e.message || "Este número já foi reservado ou ocorreu um erro.");
    },
  });

  const batchReserve = useMutation({
    mutationFn: async (numbers: number[]) => {
      if (!user) throw new Error("Você precisa estar logado.");
      const rows = numbers.map((n) => ({
        raffle_id: selectedRaffleId!,
        number: n,
        participant_name: profile?.full_name || profile?.email || "Cliente",
        user_id: user.id,
        status: "reserved",
      }));

      const { error } = await supabase.from("raffle_tickets").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.length} número(s) reservado(s) com sucesso! Realize o PIX para confirmar.`);
      qc.invalidateQueries({ queryKey: ["raffle-tickets", selectedRaffleId] });
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao reservar números.");
    },
  });

  const handleQuickPick = (count: number) => {
    if (!selectedRaffle || selectedRaffle.status !== "active") return;
    if (!user) return toast.error("Você precisa estar logado.");

    const takenNumbers = new Set(tickets?.map((t) => t.number) || []);
    const available: number[] = [];
    for (let i = 1; i <= selectedRaffle.total_numbers; i++) {
      if (!takenNumbers.has(i)) {
        available.push(i);
      }
    }

    if (available.length === 0) {
      toast.error("Não há mais números disponíveis nesta rifa.");
      return;
    }

    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(count, available.length));
    batchReserve.mutate(picked);
  };

  const cancelReservation = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase
        .from("raffle_tickets")
        .delete()
        .eq("id", ticketId)
        .eq("user_id", user?.id ?? "")
        .eq("status", "reserved");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reserva cancelada com sucesso.");
      qc.invalidateQueries({ queryKey: ["raffle-tickets", selectedRaffleId] });
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao cancelar a reserva.");
    },
  });

  const copyPixKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Chave PIX copiada!");
  };

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center max-w-md mx-auto">
        <Ticket className="h-12 w-12 text-muted-foreground animate-pulse" />
        <h3 className="font-bold text-lg text-white">Nenhuma loja ativa</h3>
        <p className="text-sm text-muted-foreground">
          Por favor, selecione uma loja no cabeçalho superior para acessar as rifas disponíveis.
        </p>
      </div>
    );
  }

  // Group tickets by number
  const ticketMap = new Map<number, typeof tickets extends Array<infer T> ? T : any>();
  if (tickets) {
    tickets.forEach((t) => {
      ticketMap.set(t.number, t);
    });
  }

  const myReservedTickets = tickets?.filter((t) => t.user_id === user?.id && t.status === "reserved") || [];
  const myPaidTickets = tickets?.filter((t) => t.user_id === user?.id && t.status === "paid") || [];
  const totalToPay = myReservedTickets.length * (selectedRaffle?.price_per_number || 0);

  // Generate pre-filled WhatsApp message
  const handleSendProof = () => {
    if (!ownerProfile?.whatsapp) {
      toast.error("Administrador não possui WhatsApp cadastrado.");
      return;
    }
    const numbersList = myReservedTickets.map((t) => String(t.number).padStart(2, "0")).join(", ");
    const text = `Olá! Gostaria de enviar o comprovante de pagamento da rifa "${selectedRaffle?.title}".\n\nNÚMEROS RESERVADOS: ${numbersList}\nValor Total: R$ ${totalToPay.toFixed(2)}`;
    const cleanPhone = ownerProfile.whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
          <Ticket className="h-7 w-7 text-primary animate-bounce" /> Rifas Ativas e Sorteios
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Participe de sorteios, reserve seus números preferidos e ganhe pontos automáticos na sua garagem!
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Side: Raffles List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Rifas do Sistema</h2>
            <div className="flex bg-muted/40 p-1 rounded-xl border border-border gap-1">
              <button
                type="button"
                onClick={() => setClientTab("active")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  clientTab === "active" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Disponíveis
              </button>
              <button
                type="button"
                onClick={() => setClientTab("hall_of_fame")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                  clientTab === "hall_of_fame" ? "bg-yellow-500 text-black" : "text-muted-foreground hover:text-white"
                }`}
              >
                <Trophy className="h-3 w-3" /> Hall da Fama
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {!raffles?.length ? (
              <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-card">
                Nenhuma rifa criada por esta loja ainda.
              </div>
            ) : (
              raffles
                .filter((r) => (clientTab === "hall_of_fame" ? r.status === "drawn" : r.status === "active"))
                .map((r) => {
                  const isSelected = r.id === selectedRaffleId;
                  const isDrawn = r.status === "drawn";
                  const thumb = r.image_url || (r.image_urls && r.image_urls.length > 0 ? r.image_urls[0] : null);
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedRaffleId(r.id);
                        setActiveImageIndex(0);
                      }}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-lg hw-glow-orange"
                          : "border-border bg-card hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex gap-3 items-center">
                        {thumb && (
                          <img
                            src={thumb}
                            alt={r.title}
                            className="h-12 w-12 rounded-xl object-cover border border-border/80 shrink-0 bg-black"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-black text-white text-base truncate flex-1">{r.title}</h3>
                            {isDrawn ? (
                              <Badge variant="secondary" className="shrink-0 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                <Trophy className="h-3 w-3 mr-1" /> Sorteada
                              </Badge>
                            ) : (
                              <Badge variant="default" className="shrink-0 bg-green-500/10 text-green-400 border-green-500/20">Ativa</Badge>
                            )}
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-bold text-primary">R$ {Number(r.price_per_number).toFixed(2)} / nº</span>
                            <span className="flex items-center gap-1 font-semibold text-secondary">
                              <Sparkles className="h-3 w-3" /> +{r.points_per_number} pts
                            </span>
                          </div>
                        </div>
                      </div>
                      {isDrawn && r.winner_number && (
                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-green-400 bg-green-950/20 px-2 py-1 rounded-xl">
                          <span className="font-black">Ganhador: {r.winner_name || "Comprador"}</span>
                          <span className="bg-green-500 text-black px-1.5 py-0.5 rounded font-black">Nº {String(r.winner_number).padStart(2, "0")}</span>
                        </div>
                      )}
                    </button>
                  );
                })
            )}
          </div>
        </div>

        {/* Right Side: Selected Raffle Details & Number Grid */}
        <div className="lg:col-span-8">
          {selectedRaffle ? (
            <div className="space-y-6">
              <Card className="border-border bg-card overflow-hidden rounded-3xl shadow-xl">
                <CardHeader className="bg-muted/10 border-b border-border p-6">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-xl md:text-2xl font-black text-white">{selectedRaffle.title}</CardTitle>
                        {selectedRaffle.status === "drawn" && (
                          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                            <Trophy className="h-3.5 w-3.5 mr-1" /> Hall da Fama
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1 text-sm text-muted-foreground">
                        {selectedRaffle.description || "Sem descrição fornecida."}
                      </CardDescription>

                      {/* Condition & Shipping Badges in Client View */}
                      <div className="flex flex-wrap gap-2 mt-3 text-xs">
                        {selectedRaffle.item_condition && (
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[11px] font-bold">
                            <Tag className="h-3 w-3 mr-1" /> {selectedRaffle.item_condition}
                          </Badge>
                        )}
                        {selectedRaffle.shipping_info && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[11px] font-bold">
                            <Truck className="h-3 w-3 mr-1" /> {selectedRaffle.shipping_info}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-primary">R$ {Number(selectedRaffle.price_per_number).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">por número da sorte</div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Countdown Timer if draw_date exists */}
                  {selectedRaffle.draw_date && selectedRaffle.status === "active" && (
                    <CountdownTimer targetDate={selectedRaffle.draw_date} />
                  )}

                  {/* Progress Bar & Scarcity Banner */}
                  {(() => {
                    const takenCount = (tickets?.length || 0);
                    const total = selectedRaffle.total_numbers;
                    const percent = Math.round((takenCount / total) * 100);
                    const isHighDemand = percent >= 70 && selectedRaffle.status === "active";

                    return (
                      <div className="bg-[#121212] border border-border/80 p-4 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            {isHighDemand ? (
                              <span className="text-red-400 font-black flex items-center gap-1 animate-pulse">
                                <Flame className="h-4 w-4 text-red-500 fill-red-500" /> QUASE ESGOTADO!
                              </span>
                            ) : (
                              "Progresso de Vendas"
                            )}
                          </span>
                          <span className="font-black text-primary">{percent}% Vendido ({takenCount}/{total} números)</span>
                        </div>
                        <div className="h-3 w-full bg-black/80 rounded-full overflow-hidden border border-border p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              percent >= 85
                                ? "bg-gradient-to-r from-yellow-500 to-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                                : "hw-gradient-orange"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Quick Pick Buttons (Surpresinha / 1-Clique) */}
                  {selectedRaffle.status === "active" && (
                    <div data-tour="client-rifa-surpresinha" className="bg-gradient-to-r from-[#181818] via-[#121212] to-[#181818] border border-border p-4 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-primary fill-primary/20" /> Compra Rápida em 1-Clique (Surpresinha)
                        </span>
                        <span className="text-[10px] text-muted-foreground font-semibold">Seleção automática aleatória</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleQuickPick(1)}
                          disabled={batchReserve.isPending}
                          className="h-10 text-xs font-bold border-border hover:border-primary hover:bg-primary/10 text-white"
                        >
                          <Dices className="h-3.5 w-3.5 mr-1 text-primary" /> +1 Nº da Sorte
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleQuickPick(3)}
                          disabled={batchReserve.isPending}
                          className="h-10 text-xs font-bold border-border hover:border-primary hover:bg-primary/10 text-white"
                        >
                          <Zap className="h-3.5 w-3.5 mr-1 text-yellow-400" /> 3 Números
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleQuickPick(5)}
                          disabled={batchReserve.isPending}
                          className="h-10 text-xs font-bold border-border hover:border-primary hover:bg-primary/10 text-white"
                        >
                          <Flame className="h-3.5 w-3.5 mr-1 text-orange-400" /> Combo 5 Nºs
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleQuickPick(10)}
                          disabled={batchReserve.isPending}
                          className="h-10 text-xs font-bold hw-gradient-orange text-white"
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1" /> Mega 10 Nºs
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Prize Images Section in Client View */}
                  {(() => {
                    const images = (selectedRaffle.image_urls && selectedRaffle.image_urls.length > 0)
                      ? selectedRaffle.image_urls
                      : (selectedRaffle.image_url ? [selectedRaffle.image_url] : []);
                    if (images.length === 0) return null;
                    const currentImg = images[activeImageIndex] || images[0];

                    return (
                      <div className="bg-[#121212] border border-border rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <ImageIcon className="h-4 w-4 text-primary" /> Prêmio(s) em Destaque
                          </span>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            Clique na imagem para ampliar
                          </span>
                        </div>

                        {/* Featured Image */}
                        <div
                          className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-80 cursor-pointer group border border-border/60"
                          onClick={() => setPreviewImage(currentImg)}
                        >
                          <img
                            src={currentImg}
                            alt={selectedRaffle.title}
                            className="w-full h-full object-contain bg-black/90 transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                            <span className="text-xs text-white font-bold flex items-center gap-1">
                              <ZoomIn className="h-4 w-4 text-primary" /> Clique para ampliar
                            </span>
                            <Badge className="bg-black/80 text-white border-border text-[10px]">
                              {activeImageIndex + 1} de {images.length}
                            </Badge>
                          </div>
                        </div>

                        {/* Thumbnails row if multiple */}
                        {images.length > 1 && (
                          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                            {images.map((img, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setActiveImageIndex(idx)}
                                className={`relative rounded-xl overflow-hidden shrink-0 h-16 w-20 border-2 transition-all bg-black ${
                                  activeImageIndex === idx
                                    ? "border-primary shadow-lg scale-105"
                                    : "border-border/60 opacity-60 hover:opacity-100"
                                }`}
                              >
                                <img src={img} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Points alert info */}
                  <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 p-4 rounded-2xl">
                    <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-black text-white block">Pontos Garantidos!</span>
                      Cada número comprado nesta rifa concede <strong className="text-primary">+{selectedRaffle.points_per_number} pontos</strong> automaticamente para o seu saldo da garagem após o administrador confirmar o pagamento.
                    </div>
                  </div>

                  {/* Winner display if drawn */}
                  {selectedRaffle.status === "drawn" && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center space-y-2">
                      <Trophy className="h-10 w-10 text-yellow-500 mx-auto animate-bounce" />
                      <h3 className="font-black text-lg text-white">Sorteio Realizado!</h3>
                      <p className="text-sm text-muted-foreground">
                        O número sorteado foi o <strong className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded text-base font-black">{String(selectedRaffle.winner_number).padStart(2, "0")}</strong>.
                      </p>
                      <div className="text-sm font-bold text-white mt-1">
                        Ganhador: <span className="text-green-400">{selectedRaffle.winner_name || "Comprador"}</span>
                      </div>
                      {selectedRaffle.drawn_at && (
                        <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-2">
                          <Calendar className="h-3 w-3" />
                          Sorteado em: {new Date(selectedRaffle.drawn_at).toLocaleString("pt-BR")}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Grid section */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-black text-sm text-white uppercase tracking-wider">Escolha seus números</h3>
                      <div className="flex flex-wrap gap-2 text-[10px]">
                        <div className="flex items-center gap-1 text-muted-foreground"><span className="h-2.5 w-2.5 rounded bg-muted border border-border"></span> Livre</div>
                        <div className="flex items-center gap-1 text-yellow-500"><span className="h-2.5 w-2.5 rounded bg-yellow-500/20 border border-yellow-500/30"></span> Reservado</div>
                        <div className="flex items-center gap-1 text-green-400"><span className="h-2.5 w-2.5 rounded bg-green-500/20 border border-green-500/30"></span> Pago</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                      {Array.from({ length: selectedRaffle.total_numbers }).map((_, index) => {
                        const num = index + 1;
                        const ticket = ticketMap.get(num);
                        const isReserved = ticket?.status === "reserved";
                        const isPaid = ticket?.status === "paid";
                        const isMine = ticket?.user_id === user?.id;

                        let bgClass = "bg-muted/30 hover:bg-muted/65 border-border hover:border-primary/50 text-muted-foreground";
                        let disabled = selectedRaffle.status === "drawn";
                        let titleText = `Número ${String(num).padStart(2, "0")} - Disponível`;

                        if (isPaid) {
                          disabled = true;
                          bgClass = isMine
                            ? "bg-green-500 text-black border-green-600 font-bold"
                            : "bg-green-950/20 text-green-400 border-green-950/50 cursor-not-allowed opacity-60";
                          titleText = `Número ${String(num).padStart(2, "0")} - Pago por ${ticket.participant_name}`;
                        } else if (isReserved) {
                          bgClass = isMine
                            ? "bg-yellow-500 text-black border-yellow-600 font-bold"
                            : "bg-yellow-950/20 text-yellow-500 border-yellow-950/50 cursor-not-allowed opacity-60";
                          disabled = !isMine; // Can click if it is mine to cancel it
                          titleText = `Número ${String(num).padStart(2, "0")} - Reservado por ${ticket.participant_name}`;
                        }

                        return (
                          <button
                            key={num}
                            type="button"
                            disabled={disabled || reserveTicket.isPending}
                            title={titleText}
                            onClick={() => {
                              if (isMine && isReserved) {
                                cancelReservation.mutate(ticket.id);
                              } else if (!isReserved && !isPaid) {
                                reserveTicket.mutate(num);
                              }
                            }}
                            className={`h-11 rounded-xl border flex flex-col items-center justify-center text-xs font-black transition-all cursor-pointer ${bgClass} select-none`}
                          >
                            <span>{String(num).padStart(2, "0")}</span>
                            {isMine && isReserved && (
                              <span className="text-[7px] text-zinc-900 leading-none">Desmarcar</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* PIX instructions area if user has reserved tickets */}
                  {myReservedTickets.length > 0 && selectedRaffle.status === "active" && (
                    <div className="bg-[#121212] border border-border rounded-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
                      <div className="flex items-center gap-2 text-primary font-black text-sm uppercase tracking-wider">
                        <CheckCircle2 className="h-4 w-4" /> Pagamento Pendente
                      </div>
                      
                      <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                        <p>
                          Você reservou {myReservedTickets.length} número(s): {" "}
                          <strong className="text-white">
                            {myReservedTickets.map((t) => String(t.number).padStart(2, "0")).join(", ")}
                          </strong>.
                        </p>
                        <p className="flex justify-between items-center border-t border-border/50 pt-2 text-sm">
                          <span>Total a pagar:</span>
                          <strong className="text-white text-base">R$ {totalToPay.toFixed(2)}</strong>
                        </p>
                      </div>

                      {selectedRaffle.pix_key && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Chave PIX de envio</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={selectedRaffle.pix_key}
                              readOnly
                              className="flex-1 bg-muted/40 border border-border rounded-xl text-xs px-3 h-10 text-white font-mono"
                            />
                            <Button
                              type="button"
                              onClick={() => copyPixKey(selectedRaffle.pix_key!)}
                              variant="secondary"
                              className="h-10 px-3 hover:bg-muted border border-border"
                              title="Copiar Chave PIX"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 flex-col sm:flex-row">
                        <Button
                          type="button"
                          onClick={handleSendProof}
                          className="flex-1 hw-gradient-orange text-white font-bold h-11"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" /> Enviar Comprovante via WhatsApp
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Summary lists of my numbers */}
                  {(myPaidTickets.length > 0 || myReservedTickets.length > 0) && (
                    <div className="border-t border-border pt-4 flex flex-wrap gap-4 text-xs">
                      {myReservedTickets.length > 0 && (
                        <div className="text-muted-foreground">
                          Reservados ({myReservedTickets.length}):{" "}
                          <span className="font-bold text-yellow-500">
                            {myReservedTickets.map((t) => String(t.number).padStart(2, "0")).join(", ")}
                          </span>
                        </div>
                      )}
                      {myPaidTickets.length > 0 && (
                        <div className="text-muted-foreground">
                          Meus números pagos ({myPaidTickets.length}):{" "}
                          <span className="font-bold text-green-400">
                            {myPaidTickets.map((t) => String(t.number).padStart(2, "0")).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground bg-card">
              Nenhuma rifa selecionada. Escolha uma rifa ao lado para ver os detalhes.
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl bg-black/95 border-border p-2 text-white overflow-hidden flex items-center justify-center">
          {previewImage && (
            <img
              src={previewImage}
              alt="Foto do Prêmio"
              className="max-h-[85vh] w-auto object-contain rounded-lg shadow-2xl"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
