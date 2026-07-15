import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSession, useRole } from "@/hooks/useAuth";
import { Flame, Trophy, Car } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const user = useSession();
  const { data: role } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && role) {
      navigate({ to: role === "admin" ? "/admin" : "/garagem", replace: true });
    }
  }, [user, role, navigate]);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-primary" />
          <span className="font-black tracking-tight text-lg">GARAGEM<span className="hw-text-flame">HW</span></span>
        </div>
        <Link to="/auth"><Button variant="secondary" size="sm">Entrar</Button></Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 md:py-28 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-secondary font-semibold mb-4">
          Programa de Fidelidade Oficial
        </p>
        <h1 className="text-4xl md:text-7xl font-black leading-[0.95] tracking-tight">
          Sua <span className="hw-text-flame">Garagem Digital</span><br />
          de Hot Wheels.
        </h1>
        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          Cada miniatura que você leva pra casa aparece aqui, rende pontos e vira
          descontos, frete grátis e miniaturas exclusivas na loja.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="hw-gradient-orange hw-glow-orange text-primary-foreground font-bold">
              Acessar minha garagem
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3 text-left">
          {[
            { icon: Car, title: "Coleção viva", desc: "Veja cada carro que você adquiriu, com foto e pontuação." },
            { icon: Trophy, title: "Pontos que rendem", desc: "Cada compra soma pontos automaticamente na sua conta." },
            { icon: Flame, title: "Resgates exclusivos", desc: "Cupons, frete grátis e miniaturas limitadas." },
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
