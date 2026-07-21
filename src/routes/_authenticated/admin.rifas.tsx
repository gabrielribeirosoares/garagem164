import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOwnedStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Ticket,
  Plus,
  Trash2,
  CheckCircle,
  Copy,
  Sparkles,
  Play,
  Share2,
  Trophy,
  Calendar,
  X,
  ChevronDown,
  Info,
  Clock,
  User
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/rifas")({
  component: AdminRifas,
});

function AdminRifas() {
  const qc = useQueryClient();
  const { data: store } = useOwnedStore();
  const storeId = store?.id;

  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editNumber, setEditNumber] = useState<number | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);

  // Form states for creating raffle
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerNumber, setPricePerNumber] = useState(5);
  const [pointsPerNumber, setPointsPerNumber] = useState(10);
  const [pixKey, setPixKey] = useState("");
  const [totalNumbers, setTotalNumbers] = useState(50);

  // Edit ticket state
  const [ticketStatus, setTicketStatus] = useState<"reserved" | "paid" | "free">("free");
  const [participantName, setParticipantName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Draw animation states
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnWinner, setDrawnWinner] = useState<{ number: number; name: string; user_id: string | null } | null>(null);
  const [animationNumber, setAnimationNumber] = useState<string>("00");
  const [animationName, setAnimationName] = useState<string>("Carregando...");
  const drawIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get store customers
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

  // Get raffles
  const { data: raffles } = useQuery({
    queryKey: ["store-raffles", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raffles")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedRaffle = raffles?.find((r) => r.id === selectedRaffleId);

  // Get tickets for selected raffle
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

  // Realtime subscription
  useEffect(() => {
    if (!selectedRaffleId) return;
    const ch = supabase
      .channel(`admin-raffle-tickets-realtime-${selectedRaffleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "raffle_tickets", filter: `raffle_id=eq.${selectedRaffleId}` }, () => {
        qc.invalidateQueries({ queryKey: ["raffle-tickets", selectedRaffleId] });
        qc.invalidateQueries({ queryKey: ["admin-customers", storeId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "raffles", filter: `id=eq.${selectedRaffleId}` }, () => {
        qc.invalidateQueries({ queryKey: ["store-raffles", storeId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [selectedRaffleId, storeId, qc]);

  // Set default selected raffle
  useEffect(() => {
    if (raffles && raffles.length > 0 && !selectedRaffleId) {
      setSelectedRaffleId(raffles[0].id);
    }
  }, [raffles, selectedRaffleId]);

  // Pre-fill fields for ticket edit
  useEffect(() => {
    if (editNumber !== null && selectedRaffle) {
      const ticket = tickets?.find((t) => t.number === editNumber);
      if (ticket) {
        setTicketStatus(ticket.status as any);
        setParticipantName(ticket.participant_name || "");
        setSelectedUserId(ticket.user_id || "");
      } else {
        setTicketStatus("free");
        setParticipantName("");
        setSelectedUserId("");
      }
    }
  }, [editNumber, tickets, selectedRaffle]);

  // Auto fill pix key from store details or default if exists
  useEffect(() => {
    if (store && !pixKey) {
      // Just seed default key or placeholder
      setPixKey("");
    }
  }, [store]);

  // Mutations
  const createRaffle = useMutation({
    mutationFn: async (values: {
      title: string;
      description: string;
      price_per_number: number;
      points_per_number: number;
      pix_key: string;
      total_numbers: number;
    }) => {
      const { data, error } = await supabase
        .from("raffles")
        .insert({
          ...values,
          store_id: storeId!,
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Rifa criada com sucesso!");
      qc.invalidateQueries({ queryKey: ["store-raffles", storeId] });
      setSelectedRaffleId(data.id);
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setPricePerNumber(5);
      setPointsPerNumber(10);
      setPixKey("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateTicket = useMutation({
    mutationFn: async ({
      number,
      status,
      participantName,
      userId,
      ticketId,
    }: {
      number: number;
      status: "reserved" | "paid" | "free";
      participantName: string;
      userId: string | null;
      ticketId?: string;
    }) => {
      if (status === "free") {
        if (ticketId) {
          const { error } = await supabase.from("raffle_tickets").delete().eq("id", ticketId);
          if (error) throw error;
        }
      } else {
        if (ticketId) {
          const { error } = await supabase
            .from("raffle_tickets")
            .update({
              status,
              participant_name: participantName,
              user_id: userId || null,
            })
            .eq("id", ticketId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("raffle_tickets").insert({
            raffle_id: selectedRaffleId!,
            number,
            status,
            participant_name: participantName,
            user_id: userId || null,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Número atualizado com sucesso!");
      qc.invalidateQueries({ queryKey: ["raffle-tickets", selectedRaffleId] });
      qc.invalidateQueries({ queryKey: ["admin-customers", storeId] });
      setEditNumber(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRaffle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("raffles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rifa excluída com sucesso!");
      qc.invalidateQueries({ queryKey: ["store-raffles", storeId] });
      setSelectedRaffleId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveWinner = useMutation({
    mutationFn: async ({
      winnerNumber,
      winnerName,
      winnerUserId,
    }: {
      winnerNumber: number;
      winnerName: string;
      winnerUserId: string | null;
    }) => {
      const { error } = await supabase
        .from("raffles")
        .update({
          status: "drawn",
          winner_number: winnerNumber,
          winner_name: winnerName,
          winner_user_id: winnerUserId,
          drawn_at: new Date().toISOString(),
        })
        .eq("id", selectedRaffleId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-raffles", storeId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Handle number click to edit
  const handleEditNumber = (num: number) => {
    if (selectedRaffle?.status === "drawn") {
      toast.error("Esta rifa já foi sorteada. Não é possível alterar números.");
      return;
    }
    setEditNumber(num);
  };

  const handleSaveTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (editNumber === null) return;
    const ticket = tickets?.find((t) => t.number === editNumber);
    updateTicket.mutate({
      number: editNumber,
      status: ticketStatus,
      participantName: participantName.trim() || "Comprador",
      userId: selectedUserId || null,
      ticketId: ticket?.id,
    });
  };

  // WhatsApp share generator
  const copyWhatsAppFormat = () => {
    if (!selectedRaffle) return;
    const ticketMap = new Map<number, any>();
    if (tickets) {
      tickets.forEach((t) => ticketMap.set(t.number, t));
    }

    const reservedOrPaid = tickets?.length || 0;
    const availableCount = selectedRaffle.total_numbers - reservedOrPaid;

    const listLines = Array.from({ length: selectedRaffle.total_numbers })
      .map((_, index) => {
        const num = index + 1;
        const t = ticketMap.get(num);
        const name = t ? t.participant_name : "";
        return `${String(num).padStart(2, "0")}- ${name}`;
      })
      .join("\n");

    const text = `🎯RIFA: ${selectedRaffle.title}\n\n✅ ${availableCount} números disponíveis\n\n💰 1 Número por R$ ${Number(selectedRaffle.price_per_number).toFixed(2)}\n\n🔑Chave PIX: ${selectedRaffle.pix_key || ""}\n\n⸻\n\nNúmeros disponíveis:\n\n${listLines}`;

    navigator.clipboard.writeText(text);
    toast.success("Lista de rifa copiada para o WhatsApp!");
  };

  // Electronic Draw logic
  const handleStartDraw = () => {
    const paidTickets = tickets?.filter((t) => t.status === "paid") || [];
    if (!paidTickets.length) {
      toast.error("Não há números PAGOS para realizar o sorteio. Marque os comprovantes como Pago.");
      return;
    }

    setDrawnWinner(null);
    setIsDrawing(true);
    setDrawOpen(true);

    const winner = paidTickets[Math.floor(Math.random() * paidTickets.length)];
    let count = 0;
    const maxShuffles = 45;

    const runShuffle = () => {
      const randomTicket = paidTickets[Math.floor(Math.random() * paidTickets.length)];
      setAnimationNumber(String(randomTicket.number).padStart(2, "0"));
      setAnimationName(randomTicket.participant_name || "Comprador");
      
      count++;
      if (count < maxShuffles) {
        // Shuffling speed profile: gets slower
        const delay = count < 25 ? 70 : count < 35 ? 120 : count < 40 ? 250 : 500;
        drawIntervalRef.current = setTimeout(runShuffle, delay);
      } else {
        // Reveal winner
        setAnimationNumber(String(winner.number).padStart(2, "0"));
        setAnimationName(winner.participant_name || "Comprador");
        setDrawnWinner({
          number: winner.number,
          name: winner.participant_name || "Comprador",
          user_id: winner.user_id,
        });
        setIsDrawing(false);
        saveWinner.mutate({
          winnerNumber: winner.number,
          winnerName: winner.participant_name || "Comprador",
          winnerUserId: winner.user_id,
        });
      }
    };

    runShuffle();
  };

  useEffect(() => {
    return () => {
      if (drawIntervalRef.current) clearTimeout(drawIntervalRef.current);
    };
  }, []);

  if (!storeId) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground bg-card max-w-lg mx-auto py-20 space-y-3">
        <Ticket className="h-12 w-12 text-muted-foreground/30 animate-pulse mx-auto" />
        <h3 className="font-bold text-white text-lg">Nenhuma loja cadastrada</h3>
        <p className="text-sm">Você precisa criar ou configurar uma loja de miniaturas primeiro para poder gerenciar as rifas.</p>
      </div>
    );
  }

  // Create ticket Map for rendering numbers grid
  const ticketMap = new Map<number, typeof tickets extends Array<infer T> ? T : any>();
  if (tickets) {
    tickets.forEach((t) => ticketMap.set(t.number, t));
  }

  const paidCount = tickets?.filter((t) => t.status === "paid").length || 0;
  const reservedCount = tickets?.filter((t) => t.status === "reserved").length || 0;
  const freeCount = selectedRaffle ? selectedRaffle.total_numbers - paidCount - reservedCount : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
            <Ticket className="h-7 w-7 text-primary" /> Gerenciador de Rifas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie rifas de miniaturas, reserve ou confirme pagamentos de números, conceda pontos automáticos e realize sorteios eletrônicos.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="hw-gradient-orange text-white font-bold h-11 px-4">
          <Plus className="h-4 w-4 mr-2" /> Nova Rifa
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: Raffles list */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Rifas do Sistema</h2>
          <div className="space-y-3">
            {!raffles?.length ? (
              <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-card">
                Nenhuma rifa cadastrada. Clique em "Nova Rifa" acima para criar a sua primeira.
              </div>
            ) : (
              raffles.map((r) => {
                const isSelected = r.id === selectedRaffleId;
                const isDrawn = r.status === "drawn";
                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-lg hw-glow-orange"
                        : "border-border bg-card hover:bg-muted/30"
                    }`}
                    onClick={() => setSelectedRaffleId(r.id)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-black text-white text-base truncate flex-1">{r.title}</h3>
                      {isDrawn ? (
                        <Badge variant="secondary" className="shrink-0 bg-zinc-800 text-zinc-400">Sorteada</Badge>
                      ) : (
                        <Badge className="shrink-0 bg-green-500/10 text-green-400 border-green-500/20">Ativa</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-bold text-primary">R$ {Number(r.price_per_number).toFixed(2)} / nº</span>
                      <span className="font-semibold text-secondary flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> +{r.points_per_number} pts
                      </span>
                    </div>

                    {isSelected && (
                      <div className="mt-4 pt-3 border-t border-border/60 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Excluir a rifa "${r.title}"? Todos os números associados serão deletados.`)) {
                              deleteRaffle.mutate(r.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Numbers grid & controls */}
        <div className="lg:col-span-8">
          {selectedRaffle ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xl">
                {/* Header detail */}
                <div className="p-6 border-b border-border bg-muted/10 flex flex-wrap justify-between items-start gap-4">
                  <div>
                    <h2 className="font-black text-xl text-white">{selectedRaffle.title}</h2>
                    <p className="text-xs text-muted-foreground mt-1 max-w-lg">
                      {selectedRaffle.description || "Sem descrição."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={copyWhatsAppFormat}
                      variant="secondary"
                      size="sm"
                      className="h-9 px-3 border border-border hover:bg-muted font-bold text-xs"
                    >
                      <Share2 className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
                    </Button>

                    {selectedRaffle.status === "active" && (
                      <Button
                        onClick={handleStartDraw}
                        className="h-9 px-3 hw-gradient-orange text-white font-bold text-xs"
                      >
                        <Play className="h-3.5 w-3.5 mr-1.5" /> Realizar Sorteio
                      </Button>
                    )}
                  </div>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-3 border-b border-border bg-[#161616]/40 text-center divide-x divide-border">
                  <div className="py-4">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Disponíveis</div>
                    <div className="text-xl font-black text-white mt-0.5">{freeCount}</div>
                  </div>
                  <div className="py-4">
                    <div className="text-[10px] uppercase font-bold text-yellow-500 tracking-wider">Reservados</div>
                    <div className="text-xl font-black text-yellow-500 mt-0.5">{reservedCount}</div>
                  </div>
                  <div className="py-4">
                    <div className="text-[10px] uppercase font-bold text-green-400 tracking-wider">Pagos</div>
                    <div className="text-xl font-black text-green-400 mt-0.5">{paidCount}</div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="p-6 space-y-6">
                  {/* Points information alert */}
                  <div className="flex items-start gap-3 bg-[#121212] border border-border/80 p-4 rounded-2xl">
                    <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-bold text-white block">Atribuição Automática de Pontos:</span>
                      Quando você altera o status de um número para <strong className="text-green-400">Pago</strong> e vincula o número a um
                      cliente cadastrado, o sistema credita <strong className="text-primary">+{selectedRaffle.points_per_number} pontos</strong> automaticamente.
                      Se o número for liberado ou alterado, os pontos serão estornados de forma automática.
                    </div>
                  </div>

                  {/* Draw summary if drawn */}
                  {selectedRaffle.status === "drawn" && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-yellow-500 text-black flex items-center justify-center rounded-xl font-bold shrink-0">
                          <Trophy className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Sorteio Concluído</div>
                          <div className="text-xs text-muted-foreground">
                            Ganhador: <span className="font-black text-green-400">{selectedRaffle.winner_name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-500 text-black font-black text-xl px-4 py-2 rounded-xl">
                        Nº {String(selectedRaffle.winner_number).padStart(2, "0")}
                      </div>
                    </div>
                  )}

                  {/* Numbers Grid */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-sm text-white">Painel de Números da Rifa</h3>
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                      {Array.from({ length: selectedRaffle.total_numbers }).map((_, index) => {
                        const num = index + 1;
                        const ticket = ticketMap.get(num);
                        const isReserved = ticket?.status === "reserved";
                        const isPaid = ticket?.status === "paid";

                        let bgClass = "bg-muted/20 border-border text-muted-foreground hover:bg-muted/50 hover:border-primary/40";
                        let titleText = `Nº ${String(num).padStart(2, "0")} - Livre`;

                        if (isPaid) {
                          bgClass = "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20";
                          titleText = `Nº ${String(num).padStart(2, "0")} - Pago por ${ticket.participant_name}`;
                        } else if (isReserved) {
                          bgClass = "bg-yellow-500/10 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/20";
                          titleText = `Nº ${String(num).padStart(2, "0")} - Reservado por ${ticket.participant_name}`;
                        }

                        return (
                          <button
                            key={num}
                            type="button"
                            title={titleText}
                            onClick={() => handleEditNumber(num)}
                            className={`h-12 rounded-xl border flex flex-col items-center justify-center text-xs font-black transition-all cursor-pointer ${bgClass}`}
                          >
                            <span>{String(num).padStart(2, "0")}</span>
                            {ticket && (
                              <span className="text-[7px] max-w-full truncate px-1 font-semibold leading-none opacity-80 mt-0.5">
                                {ticket.participant_name?.split(" ")[0]}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground bg-card">
              Nenhuma rifa ativa selecionada. Escolha uma na barra lateral ou crie uma nova.
            </div>
          )}
        </div>
      </div>

      {/* Dialog: Create Raffle */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Ticket className="h-6 w-6 text-primary" /> Criar Nova Rifa
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Preencha os dados abaixo para publicar a rifa para os membros do grupo.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createRaffle.mutate({
                title,
                description,
                price_per_number: Number(pricePerNumber),
                points_per_number: Number(pointsPerNumber),
                pix_key: pixKey,
                total_numbers: Number(totalNumbers),
              });
            }}
            className="space-y-4 pt-4"
          >
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Título do Sorteio</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Skyline GT-R R34 Super Treasure Hunt"
                required
                className="bg-[#121212] border-border text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Descrição / Regulamento</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes adicionais, regras do sorteio..."
                className="bg-[#121212] border-border text-white h-20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Valor por Número (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pricePerNumber}
                  onChange={(e) => setPricePerNumber(Number(e.target.value))}
                  required
                  className="bg-[#121212] border-border text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pontos por Número</Label>
                <Input
                  type="number"
                  value={pointsPerNumber}
                  onChange={(e) => setPointsPerNumber(Number(e.target.value))}
                  required
                  className="bg-[#121212] border-border text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Chave PIX</Label>
                <Input
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Ex: celular, e-mail ou aleatória"
                  className="bg-[#121212] border-border text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total de Números</Label>
                <select
                  value={totalNumbers}
                  onChange={(e) => setTotalNumbers(Number(e.target.value))}
                  className="w-full bg-[#121212] border border-border text-white h-10 px-3 rounded-xl text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus:border-primary"
                >
                  <option value={25}>25 Números</option>
                  <option value={50}>50 Números</option>
                  <option value={100}>100 Números</option>
                  <option value={200}>200 Números</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createRaffle.isPending} className="hw-gradient-orange text-white font-bold">
                {createRaffle.isPending ? "Criando..." : "Criar Rifa"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Number Details */}
      <Dialog open={editNumber !== null} onOpenChange={(open) => !open && setEditNumber(null)}>
        <DialogContent className="sm:max-w-[450px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white">Editar Número {String(editNumber).padStart(2, "0")}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Atribua o número a um cliente cadastrado ou preencha manualmente para um comprador externo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTicket} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status do Número</Label>
              <select
                value={ticketStatus}
                onChange={(e) => setTicketStatus(e.target.value as any)}
                className="w-full bg-[#121212] border border-border text-white h-10 px-3 rounded-xl text-sm focus-visible:outline-none focus:border-primary"
              >
                <option value="free">Livre / Disponível</option>
                <option value="reserved">Reservado</option>
                <option value="paid">Confirmado / Pago (Concede Pontos)</option>
              </select>
            </div>

            {ticketStatus !== "free" && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Comprador Cadastrado (Opcional)</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Vincula o número a um usuário registrado para conceder pontos automaticamente.
                  </p>
                  <CustomerCombobox
                    customers={customers ?? []}
                    value={selectedUserId}
                    onChange={(id) => {
                      setSelectedUserId(id);
                      const customer = customers?.find((c) => c.id === id);
                      if (customer) {
                        setParticipantName(customer.full_name || customer.email || "");
                      }
                    }}
                    placeholder="Buscar cliente por nome ou whatsapp..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome do Participante</Label>
                  <Input
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="Nome que aparecerá na lista da rifa"
                    required
                    className="bg-[#121212] border-border text-white"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
              <Button type="button" variant="ghost" onClick={() => setEditNumber(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateTicket.isPending} className="hw-gradient-orange text-white font-bold">
                {updateTicket.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Draw Animation Overlay */}
      <Dialog open={drawOpen} onOpenChange={(open) => !isDrawing && setDrawOpen(open)}>
        <DialogContent className="sm:max-w-[480px] bg-[#0c0c0c] border border-border/80 text-foreground overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-black uppercase tracking-widest text-primary">Sorteio Eletrônico</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-10 space-y-6">
            {/* Spinning Slot/Box */}
            <div className={`w-36 h-36 rounded-3xl flex flex-col items-center justify-center border-2 border-primary/50 relative overflow-hidden bg-card shadow-2xl ${isDrawing ? "hw-glow-orange animate-pulse" : "hw-glow-orange border-green-500/60 shadow-green-500/20"}`}>
              {/* Spinning background effect */}
              {isDrawing && (
                <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-primary/10 animate-pulse pointer-events-none" />
              )}
              <span className="text-5xl font-black text-white tracking-tighter leading-none select-none font-mono">
                {animationNumber}
              </span>
            </div>

            {/* Winner Display name */}
            <div className="text-center min-h-[48px] px-4">
              {isDrawing ? (
                <div className="text-muted-foreground text-sm font-semibold animate-pulse flex items-center justify-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary animate-spin" />
                  Embaralhando números...
                </div>
              ) : (
                drawnWinner && (
                  <div className="space-y-1 animate-in fade-in zoom-in-95 duration-500">
                    <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                      <Trophy className="h-4 w-4 text-yellow-500" /> Vencedor Encontrado!
                    </div>
                    <div className="text-2xl font-black text-white leading-tight">
                      {drawnWinner.name}
                    </div>
                    {drawnWinner.user_id && (
                      <div className="text-[10px] text-muted-foreground">
                        Cliente integrado · Recebeu pontos na garagem
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-center border-t border-border/30 pt-4 gap-2">
            {!isDrawing && (
              <>
                <Button onClick={handleStartDraw} variant="secondary" className="border border-border font-bold">
                  Sortear Novamente
                </Button>
                <Button onClick={() => setDrawOpen(false)} className="hw-gradient-orange text-white font-bold">
                  Concluído
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Combobox component inside file for ease of layout and avoiding dependency breaks
function CustomerCombobox({
  customers,
  value,
  onChange,
  placeholder,
}: {
  customers: any[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedCustomer = customers.find((c) => c.id === value);

  useEffect(() => {
    if (selectedCustomer) {
      const name = selectedCustomer.full_name || selectedCustomer.email || "";
      const wa = selectedCustomer.whatsapp ? ` (${selectedCustomer.whatsapp})` : "";
      setSearch(`${name}${wa}`);
    } else {
      setSearch("");
    }
  }, [value, selectedCustomer]);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase().trim();
    const matchesSelected = selectedCustomer
      ? `${selectedCustomer.full_name || selectedCustomer.email || ""}${selectedCustomer.whatsapp ? ` (${selectedCustomer.whatsapp})` : ""}`.toLowerCase() === q
      : false;
    if (!q || matchesSelected) return true;
    return (
      (c.full_name && c.full_name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.whatsapp && c.whatsapp.toLowerCase().includes(q))
    );
  });

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              onChange("");
            }
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => {
              setIsOpen(false);
              if (selectedCustomer) {
                const name = selectedCustomer.full_name || selectedCustomer.email || "";
                const wa = selectedCustomer.whatsapp ? ` (${selectedCustomer.whatsapp})` : "";
                setSearch(`${name}${wa}`);
              } else {
                setSearch("");
              }
            }, 250);
          }}
          className="w-full bg-[#121212] border border-border text-foreground h-11 px-4 pr-10 rounded-xl text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-text text-white placeholder:text-muted-foreground"
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-border rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-border/40">
          {filtered.length > 0 ? (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => {
                  onChange(c.id);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-muted/30 text-sm transition-colors text-white flex justify-between items-center"
              >
                <div>
                  <div className="font-bold">{c.full_name || "Sem nome"}</div>
                  <div className="text-[10px] text-muted-foreground">{c.email}</div>
                </div>
                {c.whatsapp && (
                  <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/20 text-[9px]">
                    {c.whatsapp}
                  </Badge>
                )}
              </button>
            ))
          ) : (
            <div className="p-3 text-xs text-muted-foreground text-center text-white">Nenhum cliente cadastrado.</div>
          )}
        </div>
      )}
    </div>
  );
}
