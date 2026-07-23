import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Package, Trash2, Pencil, X } from "lucide-react";
import { useOwnedStore } from "@/hooks/useStore";

export const Route = createFileRoute("/_authenticated/admin/recompensas")({
  component: AdminRewards,
});

type Reward = {
  id?: string;
  title: string;
  description: string;
  category: "coupon" | "shipping" | "miniature";
  image_url: string;
  cost: number;
  active: boolean;
};

const empty: Reward = { title: "", description: "", category: "coupon", image_url: "", cost: 50, active: true };

function AdminRewards() {
  const qc = useQueryClient();
  const { data: store } = useOwnedStore();
  const storeId = store?.id;
  const [form, setForm] = useState<Reward>(empty);

  const { data: rewards } = useQuery({
    queryKey: ["admin-rewards", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("rewards").select("*").eq("store_id", storeId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Loja não encontrada.");
      const payload = { ...form, description: form.description || null, image_url: form.image_url || null };
      if (form.id) {
        const { error } = await supabase.from("rewards").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rewards").insert({ ...payload, store_id: storeId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Recompensa atualizada" : "Recompensa criada");
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["admin-rewards"] });
      qc.invalidateQueries({ queryKey: ["rewards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recompensa excluída");
      qc.invalidateQueries({ queryKey: ["admin-rewards"] });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form
        data-tour="admin-recompensas-form"
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="rounded-3xl border border-border bg-card p-6 space-y-4 h-fit"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="font-black text-lg">{form.id ? "Editar Recompensa" : "Nova Recompensa"}</h2>
          </div>
          {form.id && (
            <Button type="button" variant="ghost" size="icon" onClick={() => setForm(empty)}><X className="h-4 w-4" /></Button>
          )}
        </div>

        <div className="space-y-2">
          <Label>Título</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Reward["category"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="coupon">Cupom de Desconto</SelectItem>
                <SelectItem value="shipping">Frete Grátis</SelectItem>
                <SelectItem value="miniature">Miniatura Exclusiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Custo (pontos)</Label>
            <Input type="number" min={0} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>URL da imagem</Label>
          <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
        </div>
        <Button type="submit" disabled={save.isPending} className="w-full hw-gradient-orange text-white font-bold">
          {form.id ? "Salvar alterações" : "Criar recompensa"}
        </Button>
      </form>

      <div data-tour="admin-recompensas-catalog" className="rounded-3xl border border-border bg-card overflow-hidden">
        <header className="p-5 border-b border-border">
          <h2 className="font-black">Catálogo</h2>
        </header>
        <div className="divide-y divide-border">
          {rewards?.map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0">
                {r.image_url && <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {r.category === "coupon" && "Cupom"}
                  {r.category === "shipping" && "Frete"}
                  {r.category === "miniature" && "Miniatura"}
                  {" · "}{r.cost} pts
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setForm({
                id: r.id, title: r.title, description: r.description || "", category: r.category as Reward["category"], image_url: r.image_url || "", cost: r.cost, active: r.active,
              })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {!rewards?.length && <div className="p-6 text-sm text-muted-foreground">Nenhuma recompensa cadastrada.</div>}
        </div>
      </div>
    </div>
  );
}