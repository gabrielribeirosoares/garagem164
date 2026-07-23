import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSession, useRole } from "@/hooks/useAuth";
import { useActiveClientStore, setActiveStoreSlug, useMyStores } from "@/hooks/useStore";
import { Store, Trophy, Sparkles } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const user = useSession();
  const { data: role } = useRole();
  const { data: activeStore } = useActiveClientStore();
  const { data: myStores, isLoading: loadingMyStores } = useMyStores();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: stores } = useQuery({
    queryKey: ["all-stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user || !role || loadingMyStores) return;
    if (role === "admin") {
      navigate({ to: "/admin", replace: true });
    } else if (role === "client") {
      if (activeStore) {
        navigate({ to: "/garagem", replace: true });
      } else if (myStores && myStores.length > 0) {
        if (myStores[0]?.slug) {
          setActiveStoreSlug(myStores[0].slug);
          navigate({ to: "/garagem", replace: true });
        }
      } else {
        // Novo usuário sem loja vinculada (cadastro direto sem link de indicação de loja) -> direciona para criar loja
        navigate({ to: "/create-store", replace: true });
      }
    }
  }, [user, role, activeStore, myStores, loadingMyStores, navigate]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          <span className="font-black tracking-tight text-lg">MINIS<span className="hw-text-flame">HUB</span></span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {role === "admin" ? (
                <Link to="/admin"><Button size="sm" className="hw-gradient-orange text-primary-foreground font-bold">Painel Admin</Button></Link>
              ) : activeStore ? (
                <Link to="/garagem"><Button size="sm" className="hw-gradient-orange text-primary-foreground font-bold">Minha Garagem</Button></Link>
              ) : null}
              <Button variant="secondary" size="sm" onClick={handleSignOut}>Sair</Button>
            </>
          ) : (
            <>
              <Link to="/auth"><Button variant="secondary" size="sm">Entrar</Button></Link>
              <Link to="/create-store"><Button size="sm" className="hw-gradient-orange text-primary-foreground font-bold">Criar loja</Button></Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 md:py-28 text-center">
        {user && role === "client" && !activeStore && stores && stores.length > 1 && (
          <div className="mb-12 max-w-md mx-auto p-6 rounded-2xl border border-border bg-card/60 backdrop-blur text-left animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-2 text-white">
              <Store className="h-5 w-5 text-primary" />
              Selecione uma Garagem
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Você está conectado, mas precisa escolher uma loja para acessar sua garagem e ver seus carros e pontos.
            </p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {stores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => {
                    setActiveStoreSlug(store.slug);
                    navigate({ to: "/garagem" });
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/50 bg-background/50 hover:bg-background transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {store.logo_url ? (
                      <img src={store.logo_url} alt={store.name} className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                        <Store className="h-4 w-4" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm text-white">{store.name}</div>
                      <div className="text-xs text-muted-foreground">/{store.slug}</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold" style={{ color: store.primary_color || "#f97316" }}>
                    Acessar &rarr;
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs uppercase tracking-[0.3em] text-secondary font-semibold mb-4">
          Plataforma White Label · Fidelidade para Lojas de Miniaturas
        </p>
        <h1 className="text-4xl md:text-7xl font-black leading-[0.95] tracking-tight">
          Sua loja, sua marca,<br />
          <span className="hw-text-flame">sua garagem digital</span>.
        </h1>
        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          Crie sua loja em minutos, personalize logo e cores, e ofereça um programa
          de fidelidade completo para seus clientes colecionadores.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/create-store">
            <Button size="lg" className="hw-gradient-orange hw-glow-orange text-primary-foreground font-bold">
              Criar minha loja
            </Button>
          </Link>
          {!user && (
            <Link to="/auth"><Button size="lg" variant="outline">Já tenho conta</Button></Link>
          )}
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3 text-left">
          {[
            { icon: Store, title: "Marca própria", desc: "Logo, favicon e cor primária personalizados por loja." },
            { icon: Trophy, title: "Pontos automáticos", desc: "Cada miniatura adicionada rende pontos ao cliente." },
            { icon: Sparkles, title: "Resgates exclusivos", desc: "Cupons, frete grátis e miniaturas — você controla o catálogo." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 hover:border-primary/50 transition-colors">
              <f.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
