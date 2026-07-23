import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClientStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, Search, Sparkles, MessageSquare, Car, ShieldCheck, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/loja")({
  component: ClientLoja,
});

function ClientLoja() {
  const { data: activeStore } = useActiveClientStore();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  // Fetch store owner whatsapp
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

  // Fetch inventory
  const { data: inventory } = useQuery({
    queryKey: ["store-inventory", activeStore?.id],
    enabled: !!activeStore?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_inventory")
        .select("*")
        .eq("store_id", activeStore!.id)
        .eq("status", "available")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const categories = ["Todos", "Mainline", "Premium", "TH", "STH", "Custom"];

  const filteredItems = (inventory ?? []).filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase().trim());
    const matchesCategory = selectedCategory === "Todos" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleBuyWhatsApp = (item: any) => {
    if (!ownerProfile?.whatsapp) {
      toast.error("Administrador da loja não possui WhatsApp cadastrado.");
      return;
    }
    const cleanPhone = ownerProfile.whatsapp.replace(/\D/g, "");
    const text = `Olá! Gostaria de comprar a miniatura "${item.name}" (R$ ${Number(item.price).toFixed(2)}) disponível no catálogo.`;
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (!activeStore) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center max-w-md mx-auto">
        <ShoppingBag className="h-12 w-12 text-muted-foreground animate-pulse" />
        <h3 className="font-bold text-lg text-white">Nenhuma loja selecionada</h3>
        <p className="text-sm text-muted-foreground">
          Por favor, selecione uma loja no menu superior para acessar o catálogo de vendas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
          <ShoppingBag className="h-7 w-7 text-primary" /> Vitrine de Miniaturas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Confira as miniaturas disponíveis para pronta entrega. Ao comprar, elas são adicionadas à sua garagem e geram pontos!
        </p>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-primary text-white shadow-md hw-glow-orange"
                    : "bg-card border border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Pesquisar miniatura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background border-border text-foreground pl-9 h-10 text-xs rounded-xl"
          />
        </div>
      </div>

      {/* Inventory Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {!filteredItems.length ? (
          <div className="col-span-full rounded-3xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground bg-card space-y-2">
            <Car className="h-8 w-8 text-muted-foreground/30 mx-auto animate-pulse" />
            <p>Nenhuma miniatura encontrada nesta categoria no momento.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            let categoryBadge = "bg-muted text-muted-foreground border-border";
            if (item.category === "STH") categoryBadge = "bg-yellow-500/20 text-yellow-500 border-yellow-500/40 font-black";
            if (item.category === "TH") categoryBadge = "bg-orange-500/20 text-orange-400 border-orange-500/40";
            if (item.category === "Premium") categoryBadge = "bg-blue-500/20 text-blue-400 border-blue-500/40";
            if (item.category === "Custom") categoryBadge = "bg-purple-500/20 text-purple-400 border-purple-500/40";

            return (
              <Card key={item.id} className="border-border bg-card overflow-hidden rounded-2xl flex flex-col hover:border-primary/50 transition-all hover:shadow-xl group">
                <div className="h-44 bg-muted/40 relative overflow-hidden flex items-center justify-center border-b border-border">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <Car className="h-12 w-12 text-muted-foreground/30" />
                  )}
                  <Badge variant="outline" className={`absolute top-3 right-3 text-[10px] ${categoryBadge}`}>
                    {item.category}
                  </Badge>
                </div>

                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-black text-foreground text-base leading-tight">{item.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.description || "Miniatura em perfeito estado de conservação."}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Preço</div>
                        <div className="text-lg font-black text-foreground">R$ {Number(item.price).toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-secondary flex items-center justify-end gap-1">
                          <Sparkles className="h-3 w-3" /> Pontos
                        </div>
                        <div className="text-sm font-black text-primary">+{item.points_reward} pts</div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleBuyWhatsApp(item)}
                      className="w-full hw-gradient-orange text-white font-bold h-10 text-xs"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" /> Comprar no WhatsApp
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
