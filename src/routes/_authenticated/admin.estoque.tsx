import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOwnedStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Boxes, Plus, Trash2, Edit3, ShoppingCart, Sparkles, ChevronDown, Car, Tag, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/estoque")({
  component: AdminEstoque,
});

function AdminEstoque() {
  const qc = useQueryClient();
  const { data: store } = useOwnedStore();
  const storeId = store?.id;

  const [createOpen, setCreateOpen] = useState(false);
  const [sellItem, setSellItem] = useState<any | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  const [uploadingCreateImage, setUploadingCreateImage] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);

  // Product form states for Create
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(35);
  const [pointsReward, setPointsReward] = useState(35);
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("Mainline");
  const [stockQuantity, setStockQuantity] = useState(1);

  // Product form states for Edit
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState(35);
  const [editPointsReward, setEditPointsReward] = useState(35);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editCategory, setEditCategory] = useState("Mainline");
  const [editStockQuantity, setEditStockQuantity] = useState(1);
  const [editStatus, setEditStatus] = useState("available");

  // File Upload Helper
  const handleFileUpload = async (file: File, isEdit: boolean = false) => {
    if (isEdit) setUploadingEditImage(true);
    else setUploadingCreateImage(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `inventory/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("images").getPublicUrl(fileName);
      if (isEdit) {
        setEditImageUrl(data.publicUrl);
      } else {
        setImageUrl(data.publicUrl);
      }

      toast.success("Foto enviada com sucesso!");
    } catch (err: any) {
      toast.error(`Erro no upload da foto: ${err.message}`);
    } finally {
      if (isEdit) setUploadingEditImage(false);
      else setUploadingCreateImage(false);
    }
  };

  const handleOpenEdit = (item: any) => {
    setEditItem(item);
    setEditName(item.name);
    setEditDescription(item.description || "");
    setEditPrice(item.price);
    setEditPointsReward(item.points_reward);
    setEditImageUrl(item.image_url || "");
    setEditCategory(item.category);
    setEditStockQuantity(item.stock_quantity);
    setEditStatus(item.status);
  };

  // Fetch customers
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

  // Fetch inventory
  const { data: inventory } = useQuery({
    queryKey: ["admin-inventory", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_inventory")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createItem = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from("store_inventory").insert({
        ...values,
        store_id: storeId!,
        status: "available",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item adicionado ao estoque!");
      qc.invalidateQueries({ queryKey: ["admin-inventory", storeId] });
      setCreateOpen(false);
      setName("");
      setDescription("");
      setPrice(35);
      setPointsReward(35);
      setImageUrl("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase
        .from("store_inventory")
        .update(values)
        .eq("id", editItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto atualizado com sucesso!");
      qc.invalidateQueries({ queryKey: ["admin-inventory", storeId] });
      setEditItem(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido do estoque.");
      qc.invalidateQueries({ queryKey: ["admin-inventory", storeId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // 1-Click Sell
  const executeSell = useMutation({
    mutationFn: async ({ item, customerId }: { item: any; customerId: string }) => {
      const { error: carError } = await supabase.from("cars").insert({
        store_id: storeId!,
        user_id: customerId,
        name: item.name,
        image_url: item.image_url || null,
        points: item.points_reward,
        payment_status: "paid",
        shipping_status: "pending",
      });
      if (carError) throw carError;

      const newQty = item.stock_quantity - 1;
      const newStatus = newQty <= 0 ? "sold" : "available";
      const { error: invError } = await supabase
        .from("store_inventory")
        .update({
          stock_quantity: Math.max(0, newQty),
          status: newStatus,
        })
        .eq("id", item.id);
      if (invError) throw invError;
    },
    onSuccess: () => {
      toast.success("Venda realizada com sucesso!", {
        description: "Miniatura inserida na garagem do cliente e pontos creditados.",
      });
      qc.invalidateQueries({ queryKey: ["admin-inventory", storeId] });
      qc.invalidateQueries({ queryKey: ["admin-customers", storeId] });
      setSellItem(null);
      setSelectedCustomerId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!storeId) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground bg-card max-w-lg mx-auto py-20 space-y-3">
        <Boxes className="h-12 w-12 text-muted-foreground/30 animate-pulse mx-auto" />
        <h3 className="font-bold text-white text-lg">Nenhuma loja cadastrada</h3>
        <p className="text-sm">Você precisa ter uma loja cadastrada para gerenciar o estoque.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
            <Boxes className="h-7 w-7 text-primary" /> Gerenciador de Estoque
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre itens para a vitrine da loja e faça vendas diretas para a garagem dos clientes com 1 clique.
          </p>
        </div>
        <Button data-tour="admin-estoque-add" onClick={() => setCreateOpen(true)} className="hw-gradient-orange text-white font-bold h-11 px-4">
          <Plus className="h-4 w-4 mr-2" /> Novo Produto
        </Button>
      </div>

      {/* Products Grid */}
      <div data-tour="admin-estoque-grid" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {!inventory?.length ? (
          <div className="col-span-full rounded-3xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground bg-card space-y-2">
            <Boxes className="h-8 w-8 text-muted-foreground/30 mx-auto animate-pulse" />
            <p>Nenhuma miniatura cadastrada no estoque. Clique em "Novo Produto" para adicionar.</p>
          </div>
        ) : (
          inventory.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col justify-between shadow-xl">
              <div className="h-40 bg-muted/30 relative flex items-center justify-center border-b border-border">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <Car className="h-10 w-10 text-muted-foreground/30" />
                )}
                <Badge variant="outline" className="absolute top-3 right-3 bg-zinc-900/80 text-white border-border text-[10px]">
                  {item.category}
                </Badge>
                {item.status === "sold" && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center font-black text-red-500 uppercase tracking-widest text-sm">
                    Esgotado
                  </div>
                )}
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-white text-base leading-tight">{item.name}</h3>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                    <span className="font-bold text-white text-base">R$ {Number(item.price).toFixed(2)}</span>
                    <span className="font-bold text-secondary flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> +{item.points_reward} pts
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Estoque: {item.stock_quantity} un.</div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    onClick={() => setSellItem(item)}
                    disabled={item.status === "sold"}
                    className="flex-1 hw-gradient-orange text-white font-bold h-9 text-xs"
                  >
                    <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Vender p/ Cliente
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(item)}
                    className="h-9 w-9 text-muted-foreground hover:text-white hover:bg-muted shrink-0"
                    title="Editar produto"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Remover "${item.name}" do estoque?`)) {
                        deleteItem.mutate(item.id);
                      }
                    }}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialog: Create Product */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Boxes className="h-6 w-6 text-primary" /> Novo Produto no Estoque
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createItem.mutate({
                name,
                description,
                price: Number(price),
                points_reward: Number(pointsReward),
                image_url: imageUrl.trim() || null,
                category,
                stock_quantity: Number(stockQuantity),
              });
            }}
            className="space-y-4 pt-4"
          >
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome da Miniatura</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Nissan Skyline GT-R R34 Mainline 2024"
                required
                className="bg-[#121212] border-border text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  required
                  className="bg-[#121212] border-border text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pontos Gerados</Label>
                <Input
                  type="number"
                  value={pointsReward}
                  onChange={(e) => setPointsReward(Number(e.target.value))}
                  required
                  className="bg-[#121212] border-border text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Categoria / Rarity</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#121212] border border-border text-white h-10 px-3 rounded-xl text-sm focus-visible:outline-none focus:border-primary"
                >
                  <option value="Mainline">Mainline</option>
                  <option value="Premium">Premium</option>
                  <option value="TH">Treasure Hunt (TH)</option>
                  <option value="STH">Super TH (STH)</option>
                  <option value="Custom">Custom / Edição Especial</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Qtd. em Estoque</Label>
                <Input
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(Number(e.target.value))}
                  required
                  className="bg-[#121212] border-border text-white"
                />
              </div>
            </div>

            {/* Photo Upload Section */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Foto da Miniatura</Label>

              {imageUrl && (
                <div className="h-28 w-full rounded-xl overflow-hidden bg-muted border border-border relative group mb-2">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-red-600 transition-colors text-xs"
                    title="Remover imagem"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer">
                  <div className="bg-[#121212] border border-dashed border-border hover:border-primary/50 text-white rounded-xl h-11 px-3 flex items-center justify-center gap-2 text-xs font-bold transition-colors">
                    <Upload className="h-4 w-4 text-primary" />
                    {uploadingCreateImage ? "Enviando imagem..." : "Upload de arquivo de foto"}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingCreateImage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, false);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="text-[10px] text-muted-foreground">Ou insira uma URL de imagem externa se preferir:</div>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="bg-[#121212] border-border text-white text-xs h-9"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createItem.isPending || uploadingCreateImage} className="hw-gradient-orange text-white font-bold">
                {createItem.isPending ? "Adicionando..." : "Adicionar Produto"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Product */}
      <Dialog open={editItem !== null} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Edit3 className="h-6 w-6 text-primary" /> Editar Produto no Estoque
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateItem.mutate({
                name: editName,
                description: editDescription,
                price: Number(editPrice),
                points_reward: Number(editPointsReward),
                image_url: editImageUrl.trim() || null,
                category: editCategory,
                stock_quantity: Number(editStockQuantity),
                status: editStatus,
              });
            }}
            className="space-y-4 pt-4"
          >
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome da Miniatura</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="bg-[#121212] border-border text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value))}
                  required
                  className="bg-[#121212] border-border text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pontos Gerados</Label>
                <Input
                  type="number"
                  value={editPointsReward}
                  onChange={(e) => setEditPointsReward(Number(e.target.value))}
                  required
                  className="bg-[#121212] border-border text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Categoria</Label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-[#121212] border border-border text-white h-10 px-2 rounded-xl text-xs focus-visible:outline-none focus:border-primary"
                >
                  <option value="Mainline">Mainline</option>
                  <option value="Premium">Premium</option>
                  <option value="TH">TH</option>
                  <option value="STH">STH</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Qtd. Estoque</Label>
                <Input
                  type="number"
                  value={editStockQuantity}
                  onChange={(e) => setEditStockQuantity(Number(e.target.value))}
                  required
                  className="bg-[#121212] border-border text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</Label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-[#121212] border border-border text-white h-10 px-2 rounded-xl text-xs focus-visible:outline-none focus:border-primary"
                >
                  <option value="available">Disponível</option>
                  <option value="reserved">Reservado</option>
                  <option value="sold">Esgotado</option>
                </select>
              </div>
            </div>

            {/* Photo Upload Section for Edit */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Foto da Miniatura</Label>

              {editImageUrl && (
                <div className="h-28 w-full rounded-xl overflow-hidden bg-muted border border-border relative group mb-2">
                  <img src={editImageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setEditImageUrl("")}
                    className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-red-600 transition-colors text-xs"
                    title="Remover imagem"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer">
                  <div className="bg-[#121212] border border-dashed border-border hover:border-primary/50 text-white rounded-xl h-11 px-3 flex items-center justify-center gap-2 text-xs font-bold transition-colors">
                    <Upload className="h-4 w-4 text-primary" />
                    {uploadingEditImage ? "Enviando imagem..." : "Upload de arquivo de foto"}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingEditImage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, true);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="text-[10px] text-muted-foreground">Ou insira uma URL de imagem externa se preferir:</div>
              <Input
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://..."
                className="bg-[#121212] border-border text-white text-xs h-9"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
              <Button type="button" variant="ghost" onClick={() => setEditItem(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateItem.isPending || uploadingEditImage} className="hw-gradient-orange text-white font-bold">
                {updateItem.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: 1-Click Sell to Customer */}
      <Dialog open={sellItem !== null} onOpenChange={(open) => !open && setSellItem(null)}>
        <DialogContent className="sm:max-w-[450px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white">Vender e Transferir para Garagem</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Selecione o cliente que comprou a miniatura <strong className="text-white">"{sellItem?.name}"</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="bg-[#121212] border border-border p-4 rounded-xl text-xs space-y-1">
              <div className="font-bold text-white">{sellItem?.name}</div>
              <div className="text-muted-foreground">
                Preço: R$ {Number(sellItem?.price).toFixed(2)} · Pontos a receber: <span className="text-primary font-bold">+{sellItem?.points_reward} pts</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Selecionar Cliente</Label>
              <CustomerCombobox
                customers={customers ?? []}
                value={selectedCustomerId}
                onChange={setSelectedCustomerId}
                placeholder="Pesquisar cliente por nome ou whatsapp..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
              <Button type="button" variant="ghost" onClick={() => setSellItem(null)}>
                Cancelar
              </Button>
              <Button
                disabled={!selectedCustomerId || executeSell.isPending}
                onClick={() => {
                  if (sellItem && selectedCustomerId) {
                    executeSell.mutate({ item: sellItem, customerId: selectedCustomerId });
                  }
                }}
                className="hw-gradient-orange text-white font-bold"
              >
                {executeSell.isPending ? "Processando..." : "Confirmar Venda"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Combobox component inside file for ease of layout
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
