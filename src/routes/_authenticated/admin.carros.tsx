import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Car, Trash2, PlusCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/carros")({
  component: AddCarros,
});

function AddCarros() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string>("");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [points, setPoints] = useState<number>(10);

  const { data: customers } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email,points").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: recentCars } = useQuery({
    queryKey: ["admin-recent-cars"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*, profiles:profiles!cars_user_id_fkey(full_name,email)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const addCar = useMutation({
    mutationFn: async () => {
      if (!userId || !name) throw new Error("Selecione o cliente e informe o nome do carro.");
      const { error } = await supabase.from("cars").insert({
        user_id: userId,
        name,
        image_url: imageUrl || null,
        points,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Carro adicionado à garagem do cliente!");
      setName(""); setImageUrl(""); setPoints(10);
      qc.invalidateQueries({ queryKey: ["admin-recent-cars"] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cars").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Carro removido");
      qc.invalidateQueries({ queryKey: ["admin-recent-cars"] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form
        onSubmit={(e) => { e.preventDefault(); addCar.mutate(); }}
        className="rounded-3xl border border-border bg-card p-6 space-y-4 h-fit"
      >
        <div className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-primary" />
          <h2 className="font-black text-lg">Adicionar Carro</h2>
        </div>

        <div className="space-y-2">
          <Label>Cliente</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
            <SelectContent>
              {customers?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name || c.email} · {c.points} pts
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Nome do carro</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: '70 Dodge Charger R/T" required />
        </div>

        <div className="space-y-2">
          <Label>URL da imagem</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div className="space-y-2">
          <Label>Pontuação</Label>
          <Input type="number" min={0} value={points} onChange={(e) => setPoints(Number(e.target.value))} required />
        </div>

        <Button type="submit" disabled={addCar.isPending} className="w-full hw-gradient-orange text-primary-foreground font-bold">
          {addCar.isPending ? "Salvando..." : "Adicionar à garagem"}
        </Button>
      </form>

      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <header className="p-5 border-b border-border">
          <h2 className="font-black">Últimos carros adicionados</h2>
        </header>
        <div className="divide-y divide-border">
          {!recentCars?.length && <div className="p-6 text-sm text-muted-foreground">Nenhum carro adicionado ainda.</div>}
          {recentCars?.map((c) => (
            <div key={c.id} className="p-4 flex items-center gap-3">
              <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {c.image_url ? <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" /> : <Car className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.profiles?.full_name || c.profiles?.email} · +{c.points} pts
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeCar.mutate(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}