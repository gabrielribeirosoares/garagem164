import { Link } from "@tanstack/react-router";
import { Mail, ShieldCheck, Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/60 bg-card/60 backdrop-blur-md mt-16 pb-24 md:pb-8 pt-10 text-muted-foreground text-xs">
      <div className="mx-auto max-w-6xl px-4 flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Left branding */}
        <div className="space-y-1.5 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-foreground font-black text-sm tracking-tight">
            <span className="h-6 w-6 rounded-lg hw-gradient-orange text-white flex items-center justify-center text-xs font-black shadow-sm">
              M
            </span>
            MinisHub <span className="text-muted-foreground font-normal text-xs">• Garagem 164</span>
          </div>
          <p className="text-[11px] text-muted-foreground max-w-sm">
            Sua plataforma completa de Garagem Virtual, Clube de Pontos e Sorteios para Colecionadores de Miniaturas.
          </p>
        </div>

        {/* Center contact & legal links */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
          <a
            href="mailto:minishub01@gmail.com"
            className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors bg-muted/40 hover:bg-muted border border-border/50 px-3.5 py-2 rounded-xl"
          >
            <Mail className="h-3.5 w-3.5 text-primary" />
            <span>minishub01@gmail.com</span>
          </a>

          <Link
            to="/termos"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Termos & Privacidade</span>
          </Link>
        </div>

        {/* Right copyright */}
        <div className="text-center md:text-right text-[11px] space-y-1 text-muted-foreground">
          <div>© {new Date().getFullYear()} MinisHub / Garagem 164.</div>
          <div className="flex items-center justify-center md:justify-end gap-1 text-[10px] opacity-75">
            <span>Todos os direitos reservados</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold text-primary">
              <Sparkles className="h-3 w-3" /> Hot Wheels Fans
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}
