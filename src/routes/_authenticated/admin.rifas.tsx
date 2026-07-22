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
  User,
  CheckSquare,
  Square,
  Edit3,
  Check,
  Upload,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink
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
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);

  // Multi-select state
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);

  // Form states for creating raffle
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerNumber, setPricePerNumber] = useState(5);
  const [pointsPerNumber, setPointsPerNumber] = useState(10);
  const [pixKey, setPixKey] = useState("");
  const [totalNumbers, setTotalNumbers] = useState(50);
  const [maxWinners, setMaxWinners] = useState<number>(1);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Edit Raffle State
  const [editOpen, setEditOpen] = useState(false);
  const [editingRaffleId, setEditingRaffleId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPricePerNumber, setEditPricePerNumber] = useState(5);
  const [editPointsPerNumber, setEditPointsPerNumber] = useState(10);
  const [editPixKey, setEditPixKey] = useState("");
  const [editMaxWinners, setEditMaxWinners] = useState<number>(1);
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [editNewImageUrl, setEditNewImageUrl] = useState("");
  const [uploadingEditImage, setUploadingEditImage] = useState(false);

  // Image Upload Handler
  const handleFileUpload = async (files: FileList | File[], isEdit = false) => {
    const setter = isEdit ? setEditImageUrls : setImageUrls;
    const loader = isEdit ? setUploadingEditImage : setUploadingImage;
    loader(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `raffles/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("images")
          .upload(fileName, file, { cacheControl: "3600", upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("images").getPublicUrl(fileName);
        uploadedUrls.push(data.publicUrl);
      }
      setter((prev) => [...prev, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} foto(s) do prêmio enviada(s) com sucesso!`);
    } catch (err: any) {
      toast.error(`Erro no upload da foto: ${err.message}`);
    } finally {
      loader(false);
    }
  };

  // Open Edit Raffle Modal
  const handleOpenEditRaffle = (raffle: any) => {
    setEditingRaffleId(raffle.id);
    setEditTitle(raffle.title || "");
    setEditDescription(raffle.description || "");
    setEditPricePerNumber(Number(raffle.price_per_number) || 5);
    setEditPointsPerNumber(Number(raffle.points_per_number) || 10);
    setEditPixKey(raffle.pix_key || "");
    setEditMaxWinners(raffle.max_winners || 1);
    
    // Load images
    const urls: string[] = [];
    if (raffle.image_urls && Array.isArray(raffle.image_urls) && raffle.image_urls.length > 0) {
      urls.push(...raffle.image_urls);
    } else if (raffle.image_url) {
      urls.push(raffle.image_url);
    }
    setEditImageUrls(urls);
    setEditNewImageUrl("");
    setEditOpen(true);
  };

  // Edit ticket state
  const [ticketStatus, setTicketStatus] = useState<"reserved" | "paid" | "free">("paid");
  const [participantName, setParticipantName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Draw animation states (Suporte a múltiplos ganhadores)
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnWinners, setDrawnWinners] = useState<Array<{ number: number; name: string; user_id: string | null }>>([]);
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

  // Set default selected raffle & clear selections when switching raffle
  useEffect(() => {
    if (raffles && raffles.length > 0 && !selectedRaffleId) {
      setSelectedRaffleId(raffles[0].id);
    }
    setSelectedNumbers([]);
  }, [raffles, selectedRaffleId]);

  // Mutations
  const createRaffle = useMutation({
    mutationFn: async (values: {
      title: string;
      description: string;
      price_per_number: number;
      points_per_number: number;
      pix_key: string;
      total_numbers: number;
      max_winners: number;
      image_urls: string[];
    }) => {
      const primaryUrl = values.image_urls.length > 0 ? values.image_urls[0] : null;
      const payload: any = {
        title: values.title,
        description: values.description,
        price_per_number: values.price_per_number,
        points_per_number: values.points_per_number,
        pix_key: values.pix_key,
        total_numbers: values.total_numbers,
        max_winners: values.max_winners,
        image_url: primaryUrl,
        image_urls: values.image_urls,
        store_id: storeId!,
        status: "active",
      };

      const { data, error } = await supabase
        .from("raffles")
        .insert(payload)
        .select()
        .single();
      
      if (error) {
        if (error.message?.includes("image_url")) {
          // Schema cache hasn't updated on server yet -> retry without image_url fields
          delete payload.image_url;
          delete payload.image_urls;
          const retry = await supabase.from("raffles").insert(payload).select().single();
          if (retry.error) throw retry.error;
          return retry.data;
        }
        throw error;
      }
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
      setMaxWinners(1);
      setImageUrls([]);
      setNewImageUrl("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRaffle = useMutation({
    mutationFn: async (values: {
      id: string;
      title: string;
      description: string;
      price_per_number: number;
      points_per_number: number;
      pix_key: string;
      max_winners: number;
      image_urls: string[];
    }) => {
      const primaryUrl = values.image_urls.length > 0 ? values.image_urls[0] : null;
      const payload: any = {
        title: values.title,
        description: values.description,
        price_per_number: values.price_per_number,
        points_per_number: values.points_per_number,
        pix_key: values.pix_key,
        max_winners: values.max_winners,
        image_url: primaryUrl,
        image_urls: values.image_urls,
      };

      const { data, error } = await supabase
        .from("raffles")
        .update(payload)
        .eq("id", values.id)
        .select()
        .single();
      
      if (error) {
        if (error.message?.includes("image_url")) {
          // Schema cache hasn't updated on server yet -> retry without image_url fields
          delete payload.image_url;
          delete payload.image_urls;
          const retry = await supabase.from("raffles").update(payload).eq("id", values.id).select().single();
          if (retry.error) throw retry.error;
          return retry.data;
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Rifa atualizada com sucesso!");
      qc.invalidateQueries({ queryKey: ["store-raffles", storeId] });
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const batchUpdateTickets = useMutation({
    mutationFn: async ({
      numbers,
      status,
      participantName,
      userId,
    }: {
      numbers: number[];
      status: "reserved" | "paid" | "free";
      participantName: string;
      userId: string | null;
    }) => {
      if (status === "free") {
        const { error } = await supabase
          .from("raffle_tickets")
          .delete()
          .eq("raffle_id", selectedRaffleId!)
          .in("number", numbers);
        if (error) throw error;
      } else {
        const rows = numbers.map((num) => {
          const existingTicket = tickets?.find((t) => t.number === num);
          return {
            ...(existingTicket ? { id: existingTicket.id } : {}),
            raffle_id: selectedRaffleId!,
            number: num,
            status,
            participant_name: participantName.trim() || "Comprador",
            user_id: userId || null,
          };
        });
        const { error } = await supabase
          .from("raffle_tickets")
          .upsert(rows, { onConflict: "raffle_id,number" });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.numbers.length} número(s) atualizado(s) com sucesso!`);
      qc.invalidateQueries({ queryKey: ["raffle-tickets", selectedRaffleId] });
      qc.invalidateQueries({ queryKey: ["admin-customers", storeId] });
      setSelectedNumbers([]);
      setBatchModalOpen(false);
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

  const saveWinners = useMutation({
    mutationFn: async ({
      winners,
    }: {
      winners: Array<{ number: number; name: string; user_id: string | null }>;
    }) => {
      const winnerNameFormatted = winners
        .map((w, i) => `${i + 1}º: ${w.name} (Nº ${String(w.number).padStart(2, "0")})`)
        .join(", ");
      const firstWinnerNumber = winners[0]?.number || null;
      const firstWinnerUserId = winners[0]?.user_id || null;

      const { error } = await supabase
        .from("raffles")
        .update({
          status: "drawn",
          winner_number: firstWinnerNumber,
          winner_name: winnerNameFormatted,
          winner_user_id: firstWinnerUserId,
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

  // Toggle selection of a number
  const toggleNumberSelection = (num: number) => {
    if (selectedRaffle?.status === "drawn") {
      toast.error("Esta rifa já foi sorteada. Não é possível alterar números.");
      return;
    }
    setSelectedNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort((a, b) => a - b)
    );
  };

  // Open modal for selected numbers
  const handleOpenBatchEdit = () => {
    if (selectedNumbers.length === 0) return;
    
    if (selectedNumbers.length === 1) {
      const ticket = tickets?.find((t) => t.number === selectedNumbers[0]);
      if (ticket) {
        setTicketStatus(ticket.status as any);
        setParticipantName(ticket.participant_name || "");
        setSelectedUserId(ticket.user_id || "");
      } else {
        setTicketStatus("paid");
        setParticipantName("");
        setSelectedUserId("");
      }
    } else {
      setTicketStatus("paid");
      setParticipantName("");
      setSelectedUserId("");
    }
    setBatchModalOpen(true);
  };

  const handleSaveBatchForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedNumbers.length === 0) return;
    batchUpdateTickets.mutate({
      numbers: selectedNumbers,
      status: ticketStatus,
      participantName: participantName.trim() || "Comprador",
      userId: selectedUserId || null,
    });
  };

  const copyWhatsAppFormat = () => {
    if (!selectedRaffle) return;
    const ticketMap = new Map<number, any>();
    if (tickets) {
      tickets.forEach((t) => ticketMap.set(t.number, t));
    }

    const reservedOrPaid = tickets?.length || 0;
    const availableCount = selectedRaffle.total_numbers - reservedOrPaid;

    const winnerNumbers = new Set<number>();
    if (selectedRaffle.winner_name) {
      const matches = selectedRaffle.winner_name.match(/Nº\s*(\d+)/g);
      if (matches) {
        matches.forEach((m) => {
          const num = parseInt(m.replace(/\D/g, ""), 10);
          if (!isNaN(num)) winnerNumbers.add(num);
        });
      }
    }

    const listLines = Array.from({ length: selectedRaffle.total_numbers })
      .map((_, index) => {
        const num = index + 1;
        const t = ticketMap.get(num);
        const name = t ? t.participant_name : "";
        const isWinner = winnerNumbers.has(num);
        const congrats = isWinner ? " 🥳🎉 Parabéns! Você foi um ganhador da rifa!" : "";
        
        return `${String(num).padStart(2, "0")}- ${name}${congrats}`;
      })
      .join("\n");

    const text = `🎯RIFA: ${selectedRaffle.title}\n\n✅ ${availableCount} números disponíveis\n\n💰 1 Número por R$ ${Number(selectedRaffle.price_per_number).toFixed(2)}\n\n🔑Chave PIX: ${selectedRaffle.pix_key || ""}\n\n⸻\n\nNúmeros disponíveis:\n\n${listLines}`;

    navigator.clipboard.writeText(text);
    toast.success("Lista de rifa copiada para o WhatsApp!");
  };

  const handleStartDraw = () => {
    const paidTickets = tickets?.filter((t) => t.status === "paid") || [];
    if (!paidTickets.length) {
      toast.error("Não há números PAGOS para realizar o sorteio. Marque os comprovantes como Pago.");
      return;
    }

    const maxWinners = (selectedRaffle as any)?.max_winners || 1;

    if (drawnWinners.length >= maxWinners) {
      toast.info("Todos os prêmios desta rifa já foram sorteados.");
      return;
    }

    setIsDrawing(true);
    setDrawOpen(true);

    const newWinnerTicket = paidTickets[Math.floor(Math.random() * paidTickets.length)];
    const newWinner = {
      number: newWinnerTicket.number,
      name: newWinnerTicket.participant_name || "Comprador",
      user_id: newWinnerTicket.user_id,
    };

    let count = 0;
    const maxShuffles = 45;

    const runShuffle = () => {
      const randomTicket = paidTickets[Math.floor(Math.random() * paidTickets.length)];
      setAnimationNumber(String(randomTicket.number).padStart(2, "0"));
      setAnimationName(randomTicket.participant_name || "Comprador");
      
      count++;
      if (count < maxShuffles) {
        const delay = count < 25 ? 70 : count < 35 ? 120 : count < 40 ? 250 : 500;
        drawIntervalRef.current = setTimeout(runShuffle, delay);
      } else {
        setAnimationNumber(String(newWinner.number).padStart(2, "0"));
        setAnimationName(newWinner.name);
        
        const updatedWinners = [...drawnWinners, newWinner];
        setDrawnWinners(updatedWinners);
        setIsDrawing(false);
        
        if (updatedWinners.length >= maxWinners) {
          saveWinners.mutate({ winners: updatedWinners });
        }
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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
            <Ticket className="h-7 w-7 text-primary" /> Gerenciador de Rifas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione múltiplos números de uma vez para atribuir clientes, confirmar pagamentos e conceder pontos automáticos.
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
                const thumb = r.image_url || (r.image_urls && r.image_urls.length > 0 ? r.image_urls[0] : null);
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
                            <Badge variant="secondary" className="shrink-0 bg-zinc-800 text-zinc-400">Sorteada</Badge>
                          ) : (
                            <Badge className="shrink-0 bg-green-500/10 text-green-400 border-green-500/20">Ativa</Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-bold text-primary">R$ {Number(r.price_per_number).toFixed(2)} / nº</span>
                          <span className="font-semibold text-secondary flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> +{r.points_per_number} pts
                          </span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-4 pt-3 border-t border-border/60 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs border-border hover:bg-muted text-white font-semibold"
                          onClick={() => handleOpenEditRaffle(r)}
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
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
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => handleOpenEditRaffle(selectedRaffle)}
                      variant="outline"
                      size="sm"
                      className="h-9 px-3 border border-border hover:bg-muted font-bold text-xs text-white"
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1.5" /> Editar Rifa
                    </Button>

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

                {/* Prize Image Gallery Preview in Admin */}
                {(() => {
                  const images = (selectedRaffle.image_urls && selectedRaffle.image_urls.length > 0)
                    ? selectedRaffle.image_urls
                    : (selectedRaffle.image_url ? [selectedRaffle.image_url] : []);
                  if (images.length === 0) return null;
                  return (
                    <div className="px-6 pt-6">
                      <div className="relative rounded-2xl overflow-hidden bg-[#0e0e0e] border border-border/80 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5 text-primary" /> Prêmios da Rifa ({images.length})
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
                          {images.map((img, i) => (
                            <a
                              key={i}
                              href={img}
                              target="_blank"
                              rel="noreferrer"
                              className="relative rounded-xl overflow-hidden shrink-0 border border-border/60 hover:border-primary transition-all group/item bg-black"
                            >
                              <img
                                src={img}
                                alt={`Prêmio ${i + 1}`}
                                className="h-36 md:h-44 w-auto object-cover rounded-xl"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                                <ExternalLink className="h-5 w-5 text-white" />
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
                  {/* Quick Tip Alert */}
                  <div className="flex items-center justify-between gap-3 bg-[#121212] border border-border/80 p-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Info className="h-5 w-5 text-primary shrink-0" />
                      <div className="text-xs text-muted-foreground">
                        <strong className="text-white">Seleção Múltipla Ativa:</strong> Clique nos números desejados para selecionar mais de um ao mesmo tempo e editar em lote.
                      </div>
                    </div>
                    {selectedNumbers.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedNumbers([])}
                        className="text-xs text-muted-foreground hover:text-white shrink-0"
                      >
                        Limpar seleção
                      </Button>
                    )}
                  </div>

                  {/* Draw summary if drawn */}
                  {selectedRaffle.status === "drawn" && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 bg-yellow-500 text-black flex items-center justify-center rounded-xl font-bold shrink-0 mt-0.5">
                          <Trophy className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Sorteio Concluído</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Ganhadores: <span className="font-black text-green-400">{selectedRaffle.winner_name}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Numbers Grid */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-sm text-white">Painel de Números</h3>
                      <div className="text-xs text-muted-foreground">
                        {selectedNumbers.length > 0 ? (
                          <span className="font-bold text-primary">{selectedNumbers.length} número(s) selecionado(s)</span>
                        ) : (
                          "Clique nos números para selecionar"
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                      {Array.from({ length: selectedRaffle.total_numbers }).map((_, index) => {
                        const num = index + 1;
                        const ticket = ticketMap.get(num);
                        const isReserved = ticket?.status === "reserved";
                        const isPaid = ticket?.status === "paid";
                        const isSelected = selectedNumbers.includes(num);

                        let bgClass = "bg-muted/20 border-border text-muted-foreground hover:bg-muted/50 hover:border-primary/40";
                        let titleText = `Nº ${String(num).padStart(2, "0")} - Livre`;

                        if (isPaid) {
                          bgClass = "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20";
                          titleText = `Nº ${String(num).padStart(2, "0")} - Pago por ${ticket.participant_name}`;
                        } else if (isReserved) {
                          bgClass = "bg-yellow-500/10 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/20";
                          titleText = `Nº ${String(num).padStart(2, "0")} - Reservado por ${ticket.participant_name}`;
                        }

                        if (isSelected) {
                          bgClass = "bg-primary text-primary-foreground border-primary font-black ring-2 ring-primary/50 shadow-lg scale-105";
                        }

                        return (
                          <button
                            key={num}
                            type="button"
                            title={titleText}
                            onClick={() => toggleNumberSelection(num)}
                            className={`h-12 rounded-xl border flex flex-col items-center justify-center text-xs font-black transition-all cursor-pointer relative ${bgClass}`}
                          >
                            <span className="flex items-center gap-0.5">
                              {isSelected && <Check className="h-3 w-3 shrink-0 stroke-[3]" />}
                              {String(num).padStart(2, "0")}
                            </span>
                            {ticket && !isSelected && (
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

      {/* Floating Action Bar when numbers are selected */}
      {selectedNumbers.length > 0 && selectedRaffle?.status === "active" && (
        <div className="fixed bottom-6 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-50 bg-[#161616] border border-primary/40 rounded-2xl p-4 shadow-2xl backdrop-blur-lg hw-glow-orange flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-primary-foreground font-black px-2.5 py-1 text-xs">
              {selectedNumbers.length} selecionado(s)
            </Badge>
            <span className="text-xs text-white font-mono font-bold truncate max-w-[200px] sm:max-w-xs">
              {selectedNumbers.map((n) => String(n).padStart(2, "0")).join(", ")}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
            <Button
              onClick={handleOpenBatchEdit}
              className="hw-gradient-orange text-white font-bold h-9 text-xs px-3"
            >
              <Edit3 className="h-3.5 w-3.5 mr-1.5" /> Editar / Vincular Cliente
            </Button>
            <Button
              onClick={() => {
                batchUpdateTickets.mutate({
                  numbers: selectedNumbers,
                  status: "free",
                  participantName: "",
                  userId: null,
                });
              }}
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 h-9 text-xs"
            >
              Liberar Números
            </Button>
            <Button
              onClick={() => setSelectedNumbers([])}
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-muted-foreground hover:text-white text-xs"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog: Create Raffle */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[540px] bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
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
                max_winners: Number(maxWinners),
                image_urls: imageUrls,
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

            {/* Prize Images Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Fotos do Prêmio / Prêmios (Opcional)
                </Label>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  {imageUrls.length} imagem(ns)
                </span>
              </div>

              <div className="space-y-2">
                <label className="flex cursor-pointer bg-[#121212] border border-dashed border-border hover:border-primary/60 rounded-xl p-3 items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:text-white transition-all">
                  <Upload className="h-4 w-4 text-primary" />
                  <span>{uploadingImage ? "Enviando arquivo(s)..." : "Fazer Upload de Imagem(ns)"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploadingImage}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileUpload(e.target.files, false);
                      }
                    }}
                    className="hidden"
                  />
                </label>

                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="Ou cole a URL da imagem (https://...)"
                    className="bg-[#121212] border-border text-white text-xs h-9"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (newImageUrl.trim()) {
                        setImageUrls((prev) => [...prev, newImageUrl.trim()]);
                        setNewImageUrl("");
                      }
                    }}
                    className="h-9 text-xs font-bold shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>

              {imageUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {imageUrls.map((url, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-border aspect-square bg-black">
                      <img src={url} alt={`Prêmio ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <Badge className="absolute top-1 left-1 text-[8px] bg-primary text-black font-black px-1 py-0 h-4">
                          Capa
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => setImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-black/80 text-red-400 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-950"
                        title="Remover imagem"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Chave PIX</Label>
              <Input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Ex: celular, e-mail ou aleatória"
                className="bg-[#121212] border-border text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Qtd. de Ganhadores</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={maxWinners}
                  onChange={(e) => setMaxWinners(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="Ex: 1"
                  required
                  className="bg-[#121212] border-border text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createRaffle.isPending || uploadingImage} className="hw-gradient-orange text-white font-bold">
                {createRaffle.isPending ? "Criando..." : "Criar Rifa"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Raffle */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[540px] bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Edit3 className="h-6 w-6 text-primary" /> Editar Rifa
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Atualize as fotos do prêmio, título, preços e informações desta rifa.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingRaffleId) return;
              updateRaffle.mutate({
                id: editingRaffleId,
                title: editTitle,
                description: editDescription,
                price_per_number: Number(editPricePerNumber),
                points_per_number: Number(editPointsPerNumber),
                pix_key: editPixKey,
                max_winners: Number(editMaxWinners),
                image_urls: editImageUrls,
              });
            }}
            className="space-y-4 pt-4"
          >
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Título do Sorteio</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Ex: Skyline GT-R R34 Super Treasure Hunt"
                required
                className="bg-[#121212] border-border text-white"
              />
            </div>

            {/* Prize Images Section (Edit) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Fotos do Prêmio / Prêmios
                </Label>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  {editImageUrls.length} imagem(ns)
                </span>
              </div>

              <div className="space-y-2">
                <label className="flex cursor-pointer bg-[#121212] border border-dashed border-border hover:border-primary/60 rounded-xl p-3 items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:text-white transition-all">
                  <Upload className="h-4 w-4 text-primary" />
                  <span>{uploadingEditImage ? "Enviando arquivo(s)..." : "Fazer Upload de Imagem(ns)"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploadingEditImage}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileUpload(e.target.files, true);
                      }
                    }}
                    className="hidden"
                  />
                </label>

                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={editNewImageUrl}
                    onChange={(e) => setEditNewImageUrl(e.target.value)}
                    placeholder="Ou cole a URL da imagem (https://...)"
                    className="bg-[#121212] border-border text-white text-xs h-9"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (editNewImageUrl.trim()) {
                        setEditImageUrls((prev) => [...prev, editNewImageUrl.trim()]);
                        setEditNewImageUrl("");
                      }
                    }}
                    className="h-9 text-xs font-bold shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>

              {editImageUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {editImageUrls.map((url, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-border aspect-square bg-black">
                      <img src={url} alt={`Prêmio ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <Badge className="absolute top-1 left-1 text-[8px] bg-primary text-black font-black px-1 py-0 h-4">
                          Capa
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-black/80 text-red-400 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-950"
                        title="Remover imagem"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Descrição / Regulamento</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
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
                  value={editPricePerNumber}
                  onChange={(e) => setEditPricePerNumber(Number(e.target.value))}
                  required
                  className="bg-[#121212] border-border text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pontos por Número</Label>
                <Input
                  type="number"
                  value={editPointsPerNumber}
                  onChange={(e) => setEditPointsPerNumber(Number(e.target.value))}
                  required
                  className="bg-[#121212] border-border text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Chave PIX</Label>
              <Input
                value={editPixKey}
                onChange={(e) => setEditPixKey(e.target.value)}
                placeholder="Ex: celular, e-mail ou aleatória"
                className="bg-[#121212] border-border text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Qtd. de Ganhadores</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={editMaxWinners}
                onChange={(e) => setEditMaxWinners(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="Ex: 1"
                required
                className="bg-[#121212] border-border text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateRaffle.isPending || uploadingEditImage} className="hw-gradient-orange text-white font-bold">
                {updateRaffle.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Batch Edit Selected Numbers */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white">
              Editar {selectedNumbers.length} Número(s)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Números selecionados: <strong className="text-primary">{selectedNumbers.map((n) => String(n).padStart(2, "0")).join(", ")}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveBatchForm} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status para os Números</Label>
              <select
                value={ticketStatus}
                onChange={(e) => setTicketStatus(e.target.value as any)}
                className="w-full bg-[#121212] border border-border text-white h-10 px-3 rounded-xl text-sm focus-visible:outline-none focus:border-primary"
              >
                <option value="paid">Confirmado / Pago (Concede Pontos)</option>
                <option value="reserved">Reservado</option>
                <option value="free">Livre / Disponível (Remover)</option>
              </select>
            </div>

            {ticketStatus !== "free" && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Vincular a Cliente Cadastrado (Opcional)</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Ao selecionar um cliente cadastrado e marcar como Pago, o cliente receberá <strong className="text-primary font-bold">+{selectedRaffle?.points_per_number || 0} pts</strong> por cada número selecionado.
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
                    placeholder="Pesquisar cliente por nome ou whatsapp..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome do Comprador / Participante</Label>
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
              <Button type="button" variant="ghost" onClick={() => setBatchModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={batchUpdateTickets.isPending} className="hw-gradient-orange text-white font-bold">
                {batchUpdateTickets.isPending ? "Aplicando..." : `Salvar (${selectedNumbers.length} Números)`}
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

          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            {/* Spinning Slot/Box */}
            <div className={`w-36 h-36 rounded-3xl flex flex-col items-center justify-center border-2 border-primary/50 relative overflow-hidden bg-card shadow-2xl ${isDrawing ? "hw-glow-orange animate-pulse" : "hw-glow-orange border-green-500/60 shadow-green-500/20"}`}>
              {isDrawing && (
                <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-primary/10 animate-pulse pointer-events-none" />
              )}
              <span className="text-5xl font-black text-white tracking-tighter leading-none select-none font-mono">
                {animationNumber}
              </span>
            </div>

            {/* Winner Display list */}
            <div className="text-center min-h-[48px] px-4 w-full">
              {isDrawing ? (
                <div className="text-muted-foreground text-sm font-semibold animate-pulse flex items-center justify-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary animate-spin" />
                  Embaralhando números...
                </div>
              ) : (
                drawnWinners.length > 0 && (
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-500 w-full">
                    <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                      <Trophy className="h-4 w-4 text-yellow-500" /> Vencedor(es) Encontrado(s)!
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto px-2">
                      {drawnWinners.map((winner, idx) => (
                        <div key={idx} className="bg-[#161616] border border-border/60 rounded-xl p-3 flex items-center justify-between text-left">
                          <div>
                            <div className="text-xs font-bold text-muted-foreground">{idx + 1}º Ganhador</div>
                            <div className="text-base font-black text-white leading-tight">{winner.name}</div>
                          </div>
                          <Badge className="bg-green-500 text-black font-black text-sm px-3 py-1">
                            Nº {String(winner.number).padStart(2, "0")}
                          </Badge>
                        </div>
                      ))}
                    </div>
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