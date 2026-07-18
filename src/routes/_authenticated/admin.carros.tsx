import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Car, Trash2, PlusCircle, Search, RotateCcw, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { RAW } from "@/components/ui/data";
import { useOwnedStore } from "@/hooks/useStore";

export const Route = createFileRoute("/_authenticated/admin/carros")({
  component: AddCarros,
});

function AddCarros() {
  const qc = useQueryClient();
  const { data: store } = useOwnedStore();
  const storeId = store?.id;
  const [userId, setUserId] = useState<string>("");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [points, setPoints] = useState<number>(10);
  
  const [showLinkInput, setShowLinkInput] = useState(false);
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
      setShowLinkInput(false);
      qc.invalidateQueries({ queryKey: ["admin-customers", storeId] });
    }
  }
  
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // List search & filter states
  const [selectedYear, setSelectedYear] = useState<string>("Todos");
  const [selectedCollection, setSelectedCollection] = useState<string>("Todos");
  const [selectedLote, setSelectedLote] = useState<string>("Todos");
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("year_desc");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: customers } = useQuery({
    queryKey: ["admin-customers", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_customers", {
        _store_id: storeId!,
      });
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => ({ id: r.user_id, full_name: r.full_name, email: r.email, points: r.points, whatsapp: r.whatsapp }))
        .sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));
    },
  });

  const { data: recentCars } = useQuery({
    queryKey: ["admin-recent-cars", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const addCar = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Loja não encontrada.");
      if (!userId || !name) throw new Error("Selecione o cliente e informe o nome do carro.");
      const { error } = await supabase.from("cars").insert({
        store_id: storeId,
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
      qc.invalidateQueries({ queryKey: ["admin-customer-cars"] });
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
      qc.invalidateQueries({ queryKey: ["admin-customer-cars"] });
    },
  });



  const handleNameChange = (val: string) => {
    setName(val);
    const trimmed = val.trim();
    if (trimmed.length >= 2) {
      const query = trimmed.toLowerCase();
      const matches = [];
      for (const car of RAW) {
        if (!car) continue; // Safety null-check
        if (
          String(car.name || "").toLowerCase().includes(query) ||
          String(car.series || "").toLowerCase().includes(query) ||
          (car.part && String(car.part).toLowerCase().includes(query))
        ) {
          matches.push(car);
          if (matches.length >= 10) break;
        }
      }
      setSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Extract unique filters from RAW data
  const filterOptions = useMemo(() => {
    const years = new Set<number>();
    const seriesSet = new Set<string>();
    const lotes = new Set<string>();

    for (const car of RAW) {
      if (!car) continue; // Safety null-check
      if (car.year) years.add(Number(car.year));
      if (car.series) {
        const clean = String(car.series).replace(/\s*\(\d+\/\d+\)$/, "").trim();
        if (clean) seriesSet.add(clean);
      }
      if (car.cas) lotes.add(String(car.cas).trim());
    }

    return {
      years: Array.from(years).sort((a, b) => b - a),
      series: Array.from(seriesSet).sort(),
      lotes: Array.from(lotes).sort(),
    };
  }, []);

  // Filter cars list
  const filteredCarsList = useMemo(() => {
    let result = RAW.filter(Boolean); // Filter out any null/undefined entries safely

    if (selectedYear !== "Todos") {
      const yr = Number(selectedYear);
      result = result.filter(car => Number(car.year) === yr);
    }

    if (selectedCollection !== "Todos") {
      result = result.filter(car => 
        car.series && String(car.series).toLowerCase().includes(selectedCollection.toLowerCase())
      );
    }

    if (selectedLote !== "Todos") {
      result = result.filter(car => String(car.cas) === selectedLote);
    }

    if (listSearchQuery.trim()) {
      const q = listSearchQuery.toLowerCase();
      result = result.filter(car => 
        String(car.name || "").toLowerCase().includes(q) || 
        (car.series && String(car.series).toLowerCase().includes(q)) ||
        (car.part && String(car.part).toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "year_desc") {
        const aYr = Number(a.year || 0);
        const bYr = Number(b.year || 0);
        if (bYr !== aYr) return bYr - aYr;
        return String(a.name || "").localeCompare(String(b.name || ""));
      }
      if (sortBy === "year_asc") {
        const aYr = Number(a.year || 0);
        const bYr = Number(b.year || 0);
        if (aYr !== bYr) return aYr - bYr;
        return String(a.name || "").localeCompare(String(b.name || ""));
      }
      if (sortBy === "name_asc") {
        return String(a.name || "").localeCompare(String(b.name || ""));
      }
      if (sortBy === "cas_asc") {
        return String(a.cas || "").localeCompare(String(b.cas || ""));
      }
      return 0;
    });

    return result;
  }, [selectedYear, selectedCollection, selectedLote, listSearchQuery, sortBy]);

  // Pagination configs
  const itemsPerPage = 25;
  const totalPages = Math.ceil(filteredCarsList.length / itemsPerPage);
  const activePage = Math.min(currentPage, totalPages || 1);

  const paginatedCars = useMemo(() => {
    const start = (activePage - 1) * itemsPerPage;
    return filteredCarsList.slice(start, start + itemsPerPage);
  }, [filteredCarsList, activePage, itemsPerPage]);

  const handleClearFilters = () => {
    setSelectedYear("Todos");
    setSelectedCollection("Todos");
    setSelectedLote("Todos");
    setListSearchQuery("");
    setSortBy("year_desc");
    setCurrentPage(1);
  };

  const handleSelectCarFromList = (car: any) => {
    setName(car.color ? `${car.name} (${car.color})` : car.name);
    setImageUrl(car.image || "");
    const inputElement = document.getElementById("car-name");
    if (inputElement) {
      inputElement.scrollIntoView({ behavior: "smooth", block: "center" });
      inputElement.focus();
    }
    toast.info(`Selecionado: ${car.name}. Dados preenchidos no formulário acima!`);
  };

  return (
    <div className="space-y-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addCar.mutate();
          }}
          className="rounded-3xl border border-border p-6 bg-card space-y-6 h-fit"
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary animate-pulse" />
            <h2 className="font-black text-lg">Adicionar Carro</h2>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="customer-select">Cliente</Label>
              <button
                type="button"
                onClick={() => setShowLinkInput(!showLinkInput)}
                className="text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                {showLinkInput ? "Cancelar" : "+ Vincular por E-mail"}
              </button>
            </div>
            {showLinkInput ? (
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="bg-[#121212] border-border text-foreground h-11"
                />
                <Button
                  type="button"
                  onClick={handleLinkCustomer}
                  disabled={linking}
                  className="hw-gradient-orange text-white font-bold h-11 shrink-0"
                >
                  {linking ? "Vinculando..." : "Vincular"}
                </Button>
              </div>
            ) : (
              <CustomerCombobox
                customers={customers ?? []}
                value={userId}
                onChange={setUserId}
                placeholder="Pesquise por nome, e-mail ou whatsapp..."
              />
            )}
          </div>

          <div className="space-y-2 relative">
            <Label htmlFor="car-name">Nome do carro</Label>
            <Input
              id="car-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={() => { if (name.trim().length >= 2) setShowSuggestions(true); }}
              onBlur={() => setShowSuggestions(false)}
              placeholder="Ex: '70 Dodge Charger R/T"
              required
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-xl divide-y divide-border">
                {suggestions.map((car, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="w-full text-left p-2 flex items-center gap-3 hover:bg-muted/50 transition-colors text-sm"
                    onMouseDown={() => {
                      setName(car.color ? `${car.name} (${car.color})` : car.name);
                      setImageUrl(car.image || "");
                      setShowSuggestions(false);
                    }}
                  >
                    {car.image ? (
                      <img
                        src={car.image}
                        alt={car.name}
                        className="w-10 h-10 rounded object-cover bg-muted shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                        <Car className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-foreground truncate">{car.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {car.series} {car.color && `· ${car.color}`} {car.year && `· ${car.year}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
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

      {/* FILTER BAR & CAR DATABASE */}
      <div className="space-y-4">
        <h2 className="font-black text-xl text-white uppercase tracking-wider">
          Base de Miniaturas
        </h2>
        
        <div className="rounded-3xl border border-border bg-card p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-muted-foreground tracking-wider uppercase">ANO</span>
              <select
                value={selectedYear}
                onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
                className="bg-[#181818] border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer min-w-[100px]"
              >
                <option value="Todos">Todos</option>
                {filterOptions.years.map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-muted-foreground tracking-wider uppercase">COLEÇÃO</span>
              <select
                value={selectedCollection}
                onChange={(e) => { setSelectedCollection(e.target.value); setCurrentPage(1); }}
                className="bg-[#181818] border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[200px]"
              >
                <option value="Todos">Todos</option>
                {filterOptions.series.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-muted-foreground tracking-wider uppercase">LOTE</span>
              <select
                value={selectedLote}
                onChange={(e) => { setSelectedLote(e.target.value); setCurrentPage(1); }}
                className="bg-[#181818] border border-border text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer min-w-[100px]"
              >
                <option value="Todos">Todos</option>
                {filterOptions.lotes.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4285F4]" />
              <Input
                value={listSearchQuery}
                onChange={(e) => { setListSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar nome do carro ou coleção"
                className="pl-10 bg-[#181818] border-border text-foreground focus-visible:ring-1 focus-visible:ring-primary rounded-lg h-9"
              />
            </div>

            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="border-border bg-card hover:bg-muted text-xs font-bold uppercase tracking-wider h-9"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Limpar Filtros
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-4">
            <div className="text-xs font-bold text-muted-foreground">
              Exibindo <span className="text-secondary font-black text-sm">{filteredCarsList.length === 0 ? 0 : (activePage - 1) * itemsPerPage + 1}-{Math.min(activePage * itemsPerPage, filteredCarsList.length)}</span> de <span className="text-secondary font-black text-sm">{filteredCarsList.length}</span> carros
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-muted-foreground tracking-wider uppercase">Ordenar por</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[#181818] border border-border text-foreground rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer h-7"
              >
                <option value="year_desc">Ano (Mais recente)</option>
                <option value="year_asc">Ano (Mais antigo)</option>
                <option value="name_asc">Nome (A-Z)</option>
                <option value="cas_asc">Lote (A-Z)</option>
              </select>
            </div>
          </div>

          {/* GRID OF CARS */}
          {paginatedCars.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-2xl text-muted-foreground">
              Nenhum carro encontrado com os filtros selecionados.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {paginatedCars.map((car, idx) => (
                <div
                  key={idx}
                  className="group relative rounded-2xl border border-border bg-[#0d0d0d] overflow-hidden flex flex-col justify-between hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-primary/5"
                >
                  <div className="relative aspect-[4/3] bg-neutral-950 overflow-hidden flex items-center justify-center">
                    {car.image ? (
                      <img
                        src={car.image}
                        alt={car.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Car className="h-10 w-10 text-muted-foreground/30 animate-pulse" />
                    )}
                    
                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {car.year && (
                        <span className="bg-black/85 border border-border text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                          {car.year}
                        </span>
                      )}
                      {car.cas && (
                        <span className="bg-primary/95 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                          Lote {car.cas}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-white line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {car.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground truncate leading-none">
                        {car.series}
                      </p>
                      {car.color && (
                        <p className="text-[10px] text-muted-foreground/80 leading-none">
                          Cor: {car.color}
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSelectCarFromList(car)}
                      className="w-full bg-[#181818] hover:bg-primary hover:text-white text-muted-foreground font-black text-[11px] tracking-wider uppercase h-8 rounded-lg transition-all border border-border/80 hover:border-transparent mt-1"
                    >
                      <PlusCircle className="h-3 w-3 mr-1" />
                      Selecionar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 border-t border-border/50 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo({ top: document.getElementById("car-name")?.offsetTop ?? 0, behavior: 'smooth' }); }}
                disabled={activePage === 1}
                className="border-border bg-[#121212] hover:bg-muted text-xs font-bold uppercase tracking-wider"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              
              <span className="text-xs text-muted-foreground font-bold">
                Página <span className="text-white font-black">{activePage}</span> de <span className="text-white font-black">{totalPages}</span>
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); window.scrollTo({ top: document.getElementById("car-name")?.offsetTop ?? 0, behavior: 'smooth' }); }}
                disabled={activePage === totalPages}
                className="border-border bg-[#121212] hover:bg-muted text-xs font-bold uppercase tracking-wider"
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
    <div className="relative w-full z-20">
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
          className="w-full bg-[#121212] border border-border text-foreground h-11 px-4 pr-10 rounded-xl text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-text"
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
                onClick={() => {
                  onChange(c.id);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between"
              >
                <div className="min-w-0">
                  <span className="font-bold text-white block truncate">
                    {c.full_name || c.email}
                  </span>
                  {c.whatsapp && (
                    <span className="text-xs text-secondary block truncate">
                      WhatsApp: {c.whatsapp}
                    </span>
                  )}
                </div>
                <span className="text-xs bg-muted/60 px-2 py-0.5 rounded font-black shrink-0 ml-2 text-foreground">
                  {c.points} pts
                </span>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              Nenhum cliente correspondente.
            </div>
          )}
        </div>
      )}
    </div>
  );
}