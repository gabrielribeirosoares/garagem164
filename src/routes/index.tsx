import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSession, useRole } from "@/hooks/useAuth";
import { useActiveClientStore } from "@/hooks/useStore";
import { Store, Trophy, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const user = useSession();
  const { data: role } = useRole();
  const { data: activeStore } = useActiveClientStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !role) return;
    if (role === "admin") navigate({ to: "/admin", replace: true });
    else if (activeStore) navigate({ to: "/garagem", replace: true });
  }, [user, role, activeStore, navigate]);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          <span className="font-black tracking-tight text-lg">MINIS<span className="hw-text-flame">HUB</span></span>
        </div>
        <div className="flex gap-2">
          <Link to="/auth"><Button variant="secondary" size="sm">Entrar</Button></Link>
          <Link to="/create-store"><Button size="sm" className="hw-gradient-orange text-primary-foreground font-bold">Criar loja</Button></Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 md:py-28 text-center">
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
          <Link to="/auth"><Button size="lg" variant="outline">Já tenho conta</Button></Link>
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
