import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, FileText, Lock, ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
});

function TermsPage() {
  const [activeTab, setActiveTab] = useState<"terms" | "lgpd">("terms");

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/">
            <Button variant="outline" size="sm" className="text-xs font-bold border-border text-white hover:bg-muted">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar ao Início
            </Button>
          </Link>
          <span className="text-xs text-muted-foreground">LGPD & Termos Legais</span>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 md:p-10 shadow-2xl space-y-6">
          <div className="border-b border-border pb-6 space-y-2">
            <h1 className="text-2xl md:text-4xl font-black flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" /> Termos de Uso & Política de Privacidade (LGPD)
            </h1>
            <p className="text-sm text-muted-foreground">
              Transparência, proteção de dados e regras oficiais da plataforma Gonzaga Minis.
            </p>

            {/* Navigation Tabs */}
            <div className="flex bg-[#121212] p-1.5 rounded-2xl border border-border gap-2 mt-4 max-w-md">
              <button
                type="button"
                onClick={() => setActiveTab("terms")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                  activeTab === "terms" ? "bg-primary text-black" : "text-muted-foreground hover:text-white"
                }`}
              >
                <FileText className="h-4 w-4" /> Termos de Uso
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("lgpd")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                  activeTab === "lgpd" ? "bg-primary text-black" : "text-muted-foreground hover:text-white"
                }`}
              >
                <Lock className="h-4 w-4" /> Privacidade (LGPD)
              </button>
            </div>
          </div>

          {activeTab === "terms" ? (
            <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
              <section className="bg-[#121212] p-5 rounded-2xl border border-border space-y-2">
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" /> 1. Aceitação dos Termos
                </h3>
                <p>
                  Ao se cadastrar ou utilizar os serviços do <strong>Gonzaga Minis</strong>, você declara ter lido, compreendido e concordado com todos os termos descritos neste documento. Estes termos regem a participação em rifas, o acúmulo de pontos na garagem e a navegação no sistema.
                </p>
              </section>

              <section className="bg-[#121212] p-5 rounded-2xl border border-border space-y-2">
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> 2. Participação em Rifas e Sorteios
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs">
                  <li>A reserva de números garante uma prioridade temporária para a realização do pagamento via PIX.</li>
                  <li>O pagamento deve ser efetuado dentro do prazo estipulado pelo administrador da loja para evitar o cancelamento automático ou manual da reserva.</li>
                  <li>Os sorteios são conduzidos com total transparência através de geradores de números aleatórios auditáveis.</li>
                  <li>O ganhador será notificado no painel da plataforma e via WhatsApp informado durante o cadastro.</li>
                </ul>
              </section>

              <section className="bg-[#121212] p-5 rounded-2xl border border-border space-y-2">
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" /> 3. Sistema de Fidelidade e Pontos da Garagem
                </h3>
                <p>
                  Cada compra confirmada concede pontos de fidelidade vinculados à loja emissora. Os pontos podem ser acumulados para resgate de miniaturas, prêmios ou cupons exclusivos dentro do catálogo de recompensas da loja.
                </p>
              </section>

              <section className="bg-[#121212] p-5 rounded-2xl border border-border space-y-2">
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" /> 4. Regras de Entrega e Frete
                </h3>
                <p>
                  O modelo de envio (Frete Grátis, Acumular na Garagem ou Frete pago pelo ganhador) é especificado no cartão do produto ou rifa. Miniaturas na modalidade "Acumular na Garagem" permanecem guardadas com segurança até a solicitação formal de envio pelo participante.
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
              <section className="bg-[#121212] p-5 rounded-2xl border border-border space-y-2">
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" /> 1. Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
                </h3>
                <p>
                  Garantimos a total segurança, confidencialidade e tratamento ético das suas informações pessoais. Todos os dados coletados têm a finalidade estrita de operacionalizar os serviços prestados.
                </p>
              </section>

              <section className="bg-[#121212] p-5 rounded-2xl border border-border space-y-2">
                <h3 className="font-black text-white text-base">2. Quais Dados Coletamos?</h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs">
                  <li><strong>Dados de Conta:</strong> Nome completo, e-mail e foto de perfil.</li>
                  <li><strong>Dados de Contato:</strong> Telefone / WhatsApp para comunicação sobre reservas, sorteios e envios.</li>
                  <li><strong>Dados da Garagem:</strong> Histórico de números de rifa adquiridos, resgates e saldo de pontos.</li>
                </ul>
              </section>

              <section className="bg-[#121212] p-5 rounded-2xl border border-border space-y-2">
                <h3 className="font-black text-white text-base">3. Como Protegemos seus Dados?</h3>
                <p className="text-xs">
                  Utilizamos criptografia de ponta a ponta, autenticação segura e políticas de Row Level Security (RLS) no Supabase. <strong>Seus dados pessoais nunca são comercializados, alugados ou compartilhados com terceiros sem seu consentimento prévio.</strong>
                </p>
              </section>

              <section className="bg-[#121212] p-5 rounded-2xl border border-border space-y-2">
                <h3 className="font-black text-white text-base">4. Seus Direitos (Art. 18 da LGPD)</h3>
                <p className="text-xs">
                  A qualquer momento, você pode solicitar a confirmação, correção, exportação ou exclusão definitiva dos seus dados pessoais e da sua conta entrando em contato com nosso encarregado de proteção de dados (DPO).
                </p>
              </section>
            </div>
          )}

          <div className="pt-6 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
            <span>Gonzaga Minis © 2026</span>
            <span>Documentação em conformidade com a LGPD</span>
          </div>
        </div>
      </div>
    </div>
  );
}
