import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  ShoppingBag,
  Ticket,
  Gift,
  Trophy,
  LayoutDashboard,
  Boxes,
  Package,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  HelpCircle,
  Zap,
  CheckCircle2,
  Compass
} from "lucide-react";

interface Step {
  title: string;
  badge: string;
  description: string;
  icon: any;
  highlights: string[];
  color: string;
}

const clientSteps: Step[] = [
  {
    title: "Sua Garagem Virtual 🚘",
    badge: "Visão Geral",
    description: "Sua garagem virtual é o lugar onde ficam guardadas todas as suas miniaturas colecionáveis (Hot Wheels, carretas, dioramas e réplicas).",
    icon: Car,
    highlights: [
      "Visualize o valor total da sua coleção em tempo real",
      "Confira a pontuação acumulada do seu saldo",
      "Alterne entre visualização em Grid e Lista interativa"
    ],
    color: "from-amber-500/20 to-orange-500/20 border-orange-500/30 text-orange-500"
  },
  {
    title: "Vitrine de Miniaturas 🛒",
    badge: "Loja Virtual",
    description: "Explore o catálogo completo de miniaturas em estoque da loja, com filtros por categoria e detalhes técnicos dos itens.",
    icon: ShoppingBag,
    highlights: [
      "Filtre por Lacrados na Cartela, STH, Loose e Raros",
      "Confira regras de envio e frete para sua região",
      "Compre com praticidade direta pelo WhatsApp da loja"
    ],
    color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-500"
  },
  {
    title: "Rifas & Sorteios Exclusivos 🎟️",
    badge: "Sorteios Eletrônicos",
    description: "Participe de rifas para concorrer a miniaturas raras, edições especiais e Super Treasure Hunts (STH).",
    icon: Ticket,
    highlights: [
      "Escolha seus números da sorte direto no grid",
      "Use a Compra Rápida em 1-Clique (Surpresinha)",
      "Acompanhe o Sorteio Eletrônico Automático em tempo real"
    ],
    color: "from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-500"
  },
  {
    title: "Recompensas & Saldo de Pontos 🎁",
    badge: "Clube de Vantagens",
    description: "Cada compra realizada e cada número de rifa que você adquire concede pontos automáticos para o seu saldo da garagem.",
    icon: Gift,
    highlights: [
      "Ganhe pontos automaticamente ao confirmar pagamentos",
      "Troque seus pontos por miniaturas e brindes 100% grátis",
      "Acompanhe o status das suas solicitações de resgate"
    ],
    color: "from-emerald-500/20 to-green-500/20 border-green-500/30 text-green-500"
  },
  {
    title: "Ranking da Garagem & Bônus 🏆",
    badge: "Comunidade & Indicações",
    description: "Compita no ranking dos maiores colecionadores da loja e compartilhe seu link de indicação com amigos.",
    icon: Trophy,
    highlights: [
      "Veja sua posição no Top Colecionadores da loja",
      "Copie seu link de indicação personalizado",
      "Ganhe pontos bônus quando novos colecionadores se cadastrarem"
    ],
    color: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-500"
  }
];

const adminSteps: Step[] = [
  {
    title: "Painel de Controle do Lojista 📊",
    badge: "Dashboard Admin",
    description: "Tenha controle total das métricas da sua loja em um único painel em tempo real.",
    icon: LayoutDashboard,
    highlights: [
      "Monitore o faturamento estimado e valor total em estoque",
      "Veja o total de garagens ativas e clientes vinculados",
      "Acompanhe o progresso das rifas ativas e resgates pendentes"
    ],
    color: "from-orange-500/20 to-red-500/20 border-orange-500/30 text-orange-500"
  },
  {
    title: "Gestão de Estoque & Carros 📦",
    badge: "Cadastro de Produtos",
    description: "Cadastre e atualize suas miniaturas com foto pela câmera do celular, preço, escala e frete.",
    icon: Boxes,
    highlights: [
      "Tire fotos direto da câmera do celular ou suba arquivos",
      "Defina valor em R$, pontuação na garagem e condição",
      "Edite a disponibilidade e estoques em 1 clique"
    ],
    color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-500"
  },
  {
    title: "Gerenciamento Avançado de Rifas 🎟️",
    badge: "Rifas & Reservas PIX",
    description: "Crie sorteios profissionais com galeria de imagens, gestão de reservas PIX e sorteio eletrônico.",
    icon: Ticket,
    highlights: [
      "Aprove reservas PIX de um cliente com 1-Clique",
      "Use a Seleção Inteligente Múltipla para lote de números",
      "Utilize a Compra Rápida (Surpresinha) para clientes sem cadastro",
      "Execute o Sorteio Eletrônico Automático com animação"
    ],
    color: "from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-500"
  },
  {
    title: "Garagens dos Clientes 🚘",
    badge: "Fidelização de Clientes",
    description: "Vincule veículos comprados diretamente para a garagem dos seus clientes e ajuste saldos de pontos.",
    icon: Car,
    highlights: [
      "Busque clientes por e-mail ou WhatsApp",
      "Adicione miniaturas à garagem virtual do cliente",
      "Credite ou debite pontos manualmente quando necessário"
    ],
    color: "from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-500"
  },
  {
    title: "Catálogo de Recompensas & Resgates 🎁",
    badge: "Prêmios em Pontos",
    description: "Crie prêmios trocáveis por pontos e gerencie as solicitações de resgates enviadas pelos clientes.",
    icon: Package,
    highlights: [
      "Cadastre recompensas definindo a quantidade de pontos necessária",
      "Receba notificações de solicitações de resgates",
      "Aprove ou conclua a entrega das recompensas solicitadas"
    ],
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-500"
  }
];

export function OnboardingTour({
  isAdminView = false,
  isOpen = false,
  onClose = () => {},
}: {
  isAdminView?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const steps = isAdminView ? adminSteps : clientSteps;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Reset to first step whenever tour opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen]);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    const key = isAdminView ? "hw_tour_admin_completed" : "hw_tour_client_completed";
    localStorage.setItem(key, "true");
    onClose();
  };

  if (!isOpen || !currentStep) return null;

  const StepIcon = currentStep.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden bg-card border-border text-foreground shadow-2xl rounded-3xl">
        {/* Header Banner */}
        <div className={`p-6 border-b border-border/80 bg-gradient-to-r ${currentStep.color} relative overflow-hidden`}>
          <div className="flex justify-between items-start gap-4 relative z-10">
            <div className="space-y-1.5">
              <Badge variant="outline" className="bg-background/80 backdrop-blur text-foreground border-border text-[10px] font-bold tracking-wider uppercase">
                <Compass className="h-3 w-3 mr-1 text-primary animate-spin" /> Guia Rápido • Passo {currentStepIndex + 1} de {steps.length}
              </Badge>
              <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                {currentStep.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
              title="Fechar guia"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Floating background icon */}
          <StepIcon className="absolute -right-4 -bottom-4 h-32 w-32 opacity-10 pointer-events-none text-foreground" />
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-muted-foreground leading-relaxed font-medium">
            {currentStep.description}
          </p>

          {/* Highlights Box */}
          <div className="space-y-3 bg-muted/40 border border-border/80 p-4 rounded-2xl">
            <div className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> O que você pode fazer aqui:
            </div>
            <ul className="space-y-2">
              {currentStep.highlights.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Steps Dots */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentStepIndex
                      ? "w-6 bg-primary"
                      : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                  }`}
                  title={`Ir para passo ${idx + 1}`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  className="h-9 px-3 text-xs font-bold border-border"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleNext}
                className="h-9 px-4 text-xs font-bold hw-gradient-orange text-white"
              >
                {isLastStep ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" /> Começar a Usar!
                  </>
                ) : (
                  <>
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
