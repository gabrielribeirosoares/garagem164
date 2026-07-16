import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useStoreBySlug } from "@/hooks/useStore";
import { useSession, useRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Store, Trophy, Sparkles, Car } from "lucide-react";

export const Route = createFileRoute("/$storeSlug/")({
  component: StoreLanding,
});

function StoreLanding() {
  const { storeSlug } = useParams({ from: "/$storeSlug/" });
  const { data: store } = useStoreBySlug(storeSlug);
  const user = useSession();
  const { data: role } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && role === "client") navigate({ to: "/garagem", replace: true });
    if (user && role === "admin") navigate({ to: "/admin", replace: true });
  }, [user, role, navigate]);

  const primary = store?.primary_color || "#f97316";

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 min-w-0">
          {store?.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-8 w-8 rounded object-cover" />
          ) : (
            <Store className="h-6 w-6" style={{ color: primary }} />
          )}
          <span className="font-black tracking-tight text-lg truncate">{store?.name ?? storeSlug}</span>
        </div>
        <Link to="/$storeSlug/login" params={{ storeSlug }}>
          <Button size="sm" style={{ background: primary, color: "#fff" }}>Entrar</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16 md:py-28 text-center">
        <p className="text-xs uppercase tracking-[0.3em] font-semibold mb-4" style={{ color: primary }}>
          Programa de Fidelidade
        </p>
        <h1 className="text-4xl md:text-6xl font-black leading-[0.95] tracking-tight">
          Bem-vindo à<br />
          <span style={{ color: primary }}>{store?.name ?? "sua loja"}</span>.
        </h1>
        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          Cada miniatura que você leva pra casa aparece na sua garagem, rende pontos e vira benefícios exclusivos.
        </p>
        <div className="mt-10">
          <Link to="/$storeSlug/login" params={{ storeSlug }}>
            <Button size="lg" className="font-bold" style={{ background: primary, color: "#fff" }}>
              Acessar minha garagem
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3 text-left">
          {[
            { icon: Car, title: "Coleção viva", desc: "Todos os carros da loja aparecem na sua garagem." },
            { icon: Trophy, title: "Pontos automáticos", desc: "Cada compra rende pontos no seu saldo." },
            { icon: Sparkles, title: "Resgates", desc: "Troque pontos por cupons, frete e miniaturas." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6">
              <f.icon className="h-6 w-6 mb-3" style={{ color: primary }} />
              <h3 className="font-bold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}