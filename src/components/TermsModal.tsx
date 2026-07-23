import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, FileText, Lock, CheckCircle2, Info } from "lucide-react";

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept?: () => void;
}

export function TermsModal({ open, onOpenChange, onAccept }: TermsModalProps) {
  const [activeTab, setActiveTab] = useState<"terms" | "lgpd">("terms");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-card border-border text-foreground max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-2 border-b border-border pb-4">
          <DialogTitle className="text-xl md:text-2xl font-black flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Termos de Uso & Política de Privacidade (LGPD)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Conheça as regras da plataforma MinisHub e como garantimos a proteção absoluta dos seus dados pessoais.
          </DialogDescription>

          {/* Navigation Tabs inside modal */}
          <div className="flex bg-[#121212] p-1 rounded-xl border border-border gap-1 mt-2">
            <button
              type="button"
              onClick={() => setActiveTab("terms")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "terms" ? "bg-primary text-black" : "text-muted-foreground hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> Termos de Uso
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("lgpd")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "lgpd" ? "bg-primary text-black" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Lock className="h-3.5 w-3.5" /> Privacidade (LGPD)
            </button>
          </div>
        </DialogHeader>

        {activeTab === "terms" ? (
          <div className="space-y-4 text-xs text-muted-foreground leading-relaxed py-2">
            <div className="bg-[#121212] p-3 rounded-xl border border-border/80">
              <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-primary" /> 1. Aceitação dos Termos
              </h4>
              <p>
                Ao criar uma conta ou utilizar os serviços do <strong>MinisHub</strong>, você concorda com estes Termos de Uso. Caso não concorde com qualquer disposição, solicitamos que não utilize a plataforma.
              </p>
            </div>

            <div className="bg-[#121212] p-3 rounded-xl border border-border/80">
              <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" /> 2. Participação em Rifas e Sorteios
              </h4>
              <ul className="list-disc list-inside space-y-1 mt-1 text-[11px]">
                <li>A reserva de números garante a prioridade temporária para efetivação do pagamento via PIX.</li>
                <li>Reservas não pagas no prazo estipulado pelo administrador da loja poderão ser canceladas e disponibilizadas para outros participantes.</li>
                <li>Os sorteios são conduzidos de maneira transparente através de gerador de números aleatórios auditável no painel administrativo.</li>
                <li>O ganhador será notificado através da própria plataforma e pelo WhatsApp cadastrado na sua conta.</li>
              </ul>
            </div>

            <div className="bg-[#121212] p-3 rounded-xl border border-border/80">
              <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" /> 3. Programa de Fidelidade (Garagem & Pontos)
              </h4>
              <p>
                Os pontos acumulados na compra de números de rifa ou produtos pertencem ao cliente cadastrado e são vinculados à loja emissora. Os pontos acumulados podem ser resgatados por produtos ou cupons de acordo com o catálogo vigente.
              </p>
            </div>

            <div className="bg-[#121212] p-3 rounded-xl border border-border/80">
              <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" /> 4. Envio e Entrega de Prêmios
              </h4>
              <p>
                A regra de frete (Frete Grátis, Acumular na Garagem ou Frete por conta do Ganhador) é especificada na página da rifa. Itens mantidos em "Acumular na Garagem" ficam armazenados em segurança até que a solicitação de envio seja aberta.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs text-muted-foreground leading-relaxed py-2">
            <div className="bg-[#121212] p-3 rounded-xl border border-border/80">
              <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-primary" /> 1. Compromisso com a LGPD (Lei nº 13.709/2018)
              </h4>
              <p>
                O MinisHub respeita a sua privacidade e cumpre rigorosamente as diretrizes da Lei Geral de Proteção de Dados Pessoais (LGPD). Todos os seus dados são tratados com o máximo sigilo e segurança.
              </p>
            </div>

            <div className="bg-[#121212] p-3 rounded-xl border border-border/80">
              <h4 className="font-bold text-white text-sm mb-1">2. Dados Pessoais Coletados</h4>
              <ul className="list-disc list-inside space-y-1 mt-1 text-[11px]">
                <li><strong>Identificação:</strong> Nome completo, endereço de e-mail e foto de perfil (quando fornecida).</li>
                <li><strong>Comunicação:</strong> Número de WhatsApp para confirmação de reservas, sorteios e envios.</li>
                <li><strong>Histórico:</strong> Registros de bilhetes adquiridos, histórico de pontos da garagem e resgates.</li>
              </ul>
            </div>

            <div className="bg-[#121212] p-3 rounded-xl border border-border/80">
              <h4 className="font-bold text-white text-sm mb-1">3. Finalidade do Tratamento</h4>
              <p className="text-[11px]">
                Seus dados são utilizados exclusivamente para: (a) identificar o titular dos bilhetes de rifa; (b) notificar sobre o resultado dos sorteios e entrega de prêmios; (c) gerenciar o saldo de pontos na garagem da loja. <strong>Seus dados jamais serão vendidos ou compartilhados com terceiros não autorizados.</strong>
              </p>
            </div>

            <div className="bg-[#121212] p-3 rounded-xl border border-border/80">
              <h4 className="font-bold text-white text-sm mb-1">4. Direitos do Titular (Art. 18 da LGPD)</h4>
              <p className="text-[11px]">
                Você possui o direito de: solicitar a confirmação da existência de tratamento dos seus dados, ter acesso aos dados armazenados, corrigir informações incompletas ou solicitar a exclusão definitiva da sua conta a qualquer momento mediante contato com nosso suporte.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-[10px] text-muted-foreground">
            Última atualização: Julho de 2026
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              type="button"
              className="w-full sm:w-auto hw-gradient-orange text-white font-bold h-9 text-xs px-5"
              onClick={() => {
                if (onAccept) onAccept();
                onOpenChange(false);
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Entendi e Concordo
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
