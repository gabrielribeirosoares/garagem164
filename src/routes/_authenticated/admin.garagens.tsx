import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Car, Trash2, Sparkles, AlertCircle } from "lucide-react";
import { useOwnedStore } from "@/hooks/useStore";

export const Route = createFileRoute("/_authenticated/admin/garagens")({
  component: AdminGaragens,
});

function AdminGaragens() {
  const qc = useQueryClient();
  const { data: store } = useOwnedStore();
  const storeId = store?.id;
  const [userId, setUserId] = useState<string>("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linking, setLinking] = useState(false);

  async function handleLinkCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) return toast.error("Loja não encontrada.");
    setLinking(true);
    const { error } = await supabase.rpc("link_customer_by_email", {
      _email: linkEmail.trim(),
      _store_id: storeId,
    });
    setLinking(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Cliente vinculado com sucesso!");
      setLinkEmail("");
      qc.invalidateQueries({ queryKey: ["admin-customers", storeId] });
    }
  }

  const { data: customers } = useQuery({
    queryKey: ["admin-customers", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_points")
        .select("points, user_id, profiles:profiles!customer_points_user_id_profiles_fkey(id,full_name,email)")
        .eq("store_id", storeId!);
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => ({ id: r.profiles?.id ?? r.user_id, full_name: r.profiles?.full_name, email: r.profiles?.email, points: r.points }))
        .sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));
    },
  });

  const { data: customerCars } = useQuery({
    queryKey: ["admin-customer-cars", userId, storeId],
    enabled: !!userId && !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("user_id", userId)
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for customer cars
  useEffect(() => {
    if (!userId || !storeId) return;
    const ch = supabase
      .channel(`admin-cars-${userId}-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cars", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-customer-cars", userId, storeId] });
        qc.invalidateQueries({ queryKey: ["admin-customers", storeId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, storeId, qc]);

  const removeCar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cars").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Carro removido com sucesso!");
      qc.invalidateQueries({ queryKey: ["admin-customers", storeId] });
      qc.invalidateQueries({ queryKey: ["admin-customer-cars", userId, storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCarStatus = useMutation({
    mutationFn: async ({ id, paymentStatus, shippingStatus }: { id: string; paymentStatus?: string; shippingStatus?: string }) => {
      const updates: any = {};
      if (paymentStatus !== undefined) updates.payment_status = paymentStatus;
      if (shippingStatus !== undefined) updates.shipping_status = shippingStatus;
      const { error } = await supabase.from("cars").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado com sucesso!");
      qc.invalidateQueries({ queryKey: ["admin-customer-cars", userId, storeId] });
    },
    onError: (e: Error) => {
      if (e.message.includes("column") || e.message.includes("schema cache") || e.message.includes("payment_status") || e.message.includes("shipping_status")) {
        toast.error("Erro de banco: As colunas de pagamento/envio ainda não existem no seu Supabase. Por favor, execute o script SQL no seu painel.", { duration: 8000 });
      } else {
        toast.error(e.message);
      }
    },
  });

  const selectedProfile = customers?.find(c => c.id === userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
          <Car className="h-7 w-7 text-primary" /> Garagens de Clientes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualizar, gerenciar status de pagamento e estornar miniaturas de cada cliente.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
        <div className="rounded-3xl border border-border p-6 bg-card space-y-4">
          <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider block">
            Selecionar Cliente
          </label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-full bg-[#121212] border-border text-foreground h-11">
              <SelectValue placeholder="Escolha um cliente da lista" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              {customers && customers.length > 0 ? (
                customers.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="hover:bg-muted/50 focus:bg-muted/50 cursor-pointer">
                    {c.full_name || c.email} · {c.points} pts
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled className="text-muted-foreground text-xs">
                  Nenhum cliente. Use o formulário ao lado para vincular.
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <form onSubmit={handleLinkCustomer} className="rounded-3xl border border-border p-6 bg-card space-y-4">
          <div>
            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider block">
              Vincular Cliente por E-mail
            </label>
            <p className="text-xs text-muted-foreground mt-0.5">Associe um cliente cadastrado à sua loja.</p>
          </div>
          <div className="flex gap-2">
            <Input
              type="email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="cliente@email.com"
              required
              className="bg-[#121212] border-border text-foreground h-11"
            />
            <Button type="submit" disabled={linking} className="hw-gradient-orange text-white font-bold h-11 px-4 shrink-0">
              {linking ? "Vinculando..." : "Vincular"}
            </Button>
          </div>
        </form>
      </div>

      {userId ? (
        <div className="rounded-3xl border border-border bg-card overflow-hidden max-w-4xl shadow-xl">
          <div className="p-6 border-b border-border flex items-center justify-between gap-4 bg-muted/20">
            <div>
              <h2 className="font-black text-xl text-white flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                Garagem de {selectedProfile?.full_name || "Cliente"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total de {customerCars?.length ?? 0} miniaturas · {selectedProfile?.points ?? 0} pts acumulados no cadastro
              </p>
            </div>
          </div>

          <div className="divide-y divide-border">
            {!customerCars?.length ? (
              <div className="p-12 text-sm text-muted-foreground text-center flex flex-col items-center justify-center space-y-2">
                <Car className="h-8 w-8 text-muted-foreground/30 animate-pulse" />
                <p>Nenhuma miniatura cadastrada na garagem deste cliente.</p>
              </div>
            ) : (
              customerCars.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-14 w-14 rounded-xl bg-muted overflow-hidden flex items-center justify-center shrink-0 border border-border/80 shadow-md">
                      {c.image_url ? (
                        <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <Car className="h-6 w-6 text-muted-foreground/55" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="font-black text-base text-white truncate leading-snug">{c.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="font-bold text-primary">+{c.points} pts</span>
                        <span>·</span>
                        <span>Cadastrado em {new Date(c.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      
                      {/* Payment/Shipping Status Badges */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {/* Payment Status */}
                        <button
                          type="button"
                          onClick={() => updateCarStatus.mutate({ 
                            id: c.id, 
                            paymentStatus: c.payment_status === "paid" ? "pending" : "paid" 
                          })}
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded cursor-pointer transition-all border ${
                            c.payment_status === "paid"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/25"
                          }`}
                          title="Clique para alternar o status de pagamento"
                        >
                          {c.payment_status === "paid" ? "Pago" : "Aguardando Pagto"}
                        </button>

                        {/* Shipping Status */}
                        <button
                          type="button"
                          onClick={() => updateCarStatus.mutate({ 
                            id: c.id, 
                            shippingStatus: c.shipping_status === "shipped" ? "pending" : "shipped" 
                          })}
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded cursor-pointer transition-all border ${
                            c.shipping_status === "shipped"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/25"
                              : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/25"
                          }`}
                          title="Clique para alternar o status de envio"
                        >
                          {c.shipping_status === "shipped" ? "Enviado" : "Pendente Envio"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => {
                      if (confirm(`Deseja realmente remover o carro "${c.name}"? Isso também subtrairá os ${c.points} pontos do cliente.`)) {
                        removeCar.mutate(c.id);
                      }
                    }}
                    className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0 h-9 w-9 rounded-lg border border-transparent hover:border-destructive/20 ml-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border p-12 max-w-xl text-center flex flex-col items-center justify-center space-y-3 bg-card">
          <AlertCircle className="h-8 w-8 text-muted-foreground/45" />
          <h3 className="font-bold text-base text-white">Nenhum cliente selecionado</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Escolha um cliente no menu acima para carregar o inventário de carros dele, controlar faturas e fazer estornos.
          </p>
        </div>
      )}
    </div>
  );
}
