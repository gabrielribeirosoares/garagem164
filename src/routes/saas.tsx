import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Car, Trophy, Sparkles, Ticket, ShoppingBag, ShieldCheck, Flame, ArrowRight, CheckCircle2, Zap, Users } from "lucide-react";

export const Route = createFileRoute("/saas")({
  component: SaasLanding,
});

function SaasLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl hw-gradient-orange flex items-center justify-center text-white font-black">
              <Flame className="h-5 w-5" />
            </div>
            <span className="font-black text-xl tracking-tight text-white uppercase">
              Gonzaga<span className="text-primary">SaaS</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="font-bold text-xs">Entrar</Button>
            </Link>
            <Link to="/create-store">
              <Button size="sm" className="hw-gradient-orange text-white font-bold text-xs px-4">
                Criar Minha Loja
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-5xl px-6 py-20 md:py-28 text-center space-y-8">
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs px-4 py-1 rounded-full uppercase tracking-wider font-bold">
          ⚡ A Plataforma #1 para Lojas de Miniaturas & Garagens
        </Badge>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight">
          Transforme sua loja de miniaturas em um <span className="hw-text-flame">Clube VIP de Fidelidade</span>.
        </h1>

        <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Gerencie garagens digitais para seus clientes, publique rifas com sorteio eletrônico, ofereça programa de pontos e venda seu estoque em 1 clique direto no WhatsApp.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link to="/create-store">
            <Button size="lg" className="hw-gradient-orange text-white font-bold text-base h-14 px-8 rounded-2xl hw-glow-orange">
              Criar Minha Loja Agora <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
          <a href="#recursos">
            <Button variant="secondary" size="lg" className="border border-border font-bold text-base h-14 px-8 rounded-2xl">
              Ver Todos os Recursos
            </Button>
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section id="recursos" className="mx-auto max-w-6xl px-6 py-16 space-y-12 border-t border-border/50">
        <div className="text-center space-y-2">
          <h2 className="text-xs uppercase font-bold text-primary tracking-widest">Tudo o que sua loja precisa</h2>
          <p className="text-3xl font-black text-white">Recursos Desenvolvidos para Colecionadores</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Car,
              title: "Garagem Digital do Cliente",
              desc: "Seus clientes acompanham cada miniatura comprada na sua loja, com fotos, status de pagamento, frete e histórico.",
            },
            {
              icon: Ticket,
              title: "Gestor de Rifas & Sorteios",
              desc: "Crie rifas em segundos, exporte listas formatadas para grupos do WhatsApp e faça o sorteio com roleta eletrônica.",
            },
            {
              icon: Trophy,
              title: "Pontos & Recompensas",
              desc: "Cada miniatura vendida rende pontos ao cliente. Eles trocam pontos acumulados por cupons, frete grátis e prêmios.",
            },
            {
              icon: ShoppingBag,
              title: "Vitrine de Estoque & 1-Click Sell",
              desc: "Exiba seu catálogo de pronta entrega na loja e transfira itens diretamente para a garagem do comprador com 1 clique.",
            },
            {
              icon: Users,
              title: "Ranking & Gamificação",
              desc: "Engaje seu grupo com Leaderboard dos maiores colecionadores e badges exclusivas (Iniciante, Entusiasta, Lenda).",
            },
            {
              icon: Zap,
              title: "Programa Indique e Ganhe",
              desc: "Links de indicação exclusivos para seus clientes trazerem novos amigos para comprar na sua loja de miniaturas.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl border border-border bg-card p-6 space-y-3 hover:border-primary/50 transition-all hover:shadow-xl group">
              <div className="h-12 w-12 rounded-2xl hw-gradient-orange flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="font-black text-white text-lg">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="mx-auto max-w-6xl px-6 py-20 space-y-12 border-t border-border/50">
        <div className="text-center space-y-2">
          <h2 className="text-xs uppercase font-bold text-primary tracking-widest">Planos de Assinatura</h2>
          <p className="text-3xl font-black text-white">Escolha o Plano Ideal para a Sua Loja</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 items-stretch">
          {/* Starter */}
          <div className="rounded-3xl border border-border bg-card p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="font-bold text-muted-foreground text-sm uppercase">Starter</div>
              <div className="text-4xl font-black text-white">R$ 0 <span className="text-sm font-normal text-muted-foreground">/ mês</span></div>
              <p className="text-xs text-muted-foreground">Ideal para lojas iniciantes organizarem suas primeiras garagens.</p>
              <div className="space-y-2.5 pt-4 text-xs">
                {["Até 50 clientes ativos", "Até 100 miniaturas cadastradas", "Rifas ilimitadas", "Suporte da comunidade"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {item}
                  </div>
                ))}
              </div>
            </div>
            <Link to="/create-store">
              <Button variant="secondary" className="w-full border border-border font-bold h-11">Começar Grátis</Button>
            </Link>
          </div>

          {/* Pro (Featured) */}
          <div className="rounded-3xl border-2 border-primary bg-card p-8 flex flex-col justify-between space-y-6 hw-glow-orange relative">
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-black font-black uppercase text-[10px] px-3 py-1">
              Mais Popular
            </Badge>
            <div className="space-y-4">
              <div className="font-bold text-primary text-sm uppercase">Pro Lojista</div>
              <div className="text-4xl font-black text-white">R$ 49 <span className="text-sm font-normal text-muted-foreground">/ mês</span></div>
              <p className="text-xs text-muted-foreground">Para lojas em crescimento que buscam vender mais e engajar no WhatsApp.</p>
              <div className="space-y-2.5 pt-4 text-xs">
                {[
                  "Clientes ILIMITADOS",
                  "Garagens & Miniaturas ILIMITADAS",
                  "Vitrine de Estoque & 1-Click Sell",
                  "Sorteios Eletrônicos ilimitados",
                  "Gerador de Texto p/ WhatsApp",
                  "Programa Indique e Ganhe",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-white font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {item}
                  </div>
                ))}
              </div>
            </div>
            <Link to="/create-store">
              <Button className="w-full hw-gradient-orange text-white font-bold h-12">Criar Minha Loja Pro</Button>
            </Link>
          </div>

          {/* VIP Custom */}
          <div className="rounded-3xl border border-border bg-card p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="font-bold text-muted-foreground text-sm uppercase">VIP Custom</div>
              <div className="text-4xl font-black text-white">R$ 99 <span className="text-sm font-normal text-muted-foreground">/ mês</span></div>
              <p className="text-xs text-muted-foreground">Para grandes marcas e eventos de diecast com domínio próprio.</p>
              <div className="space-y-2.5 pt-4 text-xs">
                {["Tudo do plano Pro", "Domínio próprio personalizado", "Suporte prioritário no WhatsApp", "Personalização total de cores e marca"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {item}
                  </div>
                ))}
              </div>
            </div>
            <Link to="/create-store">
              <Button variant="secondary" className="w-full border border-border font-bold h-11">Contatar Vendas</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="border-t border-border/80 bg-black/40 py-12">
        <div className="mx-auto max-w-4xl px-6 text-center space-y-6">
          <h2 className="text-2xl md:text-3xl font-black text-white">Pronto para transformar sua loja de miniaturas?</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Crie sua conta agora mesmo e configure seu clube de fidelidade em menos de 2 minutos.
          </p>
          <Link to="/create-store">
            <Button size="lg" className="hw-gradient-orange text-white font-bold text-base h-12 px-8 rounded-xl">
              Começar Agora
            </Button>
          </Link>
        </div>
      </footer>
    </div>
  );
}
