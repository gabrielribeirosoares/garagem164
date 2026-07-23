import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSession } from "@/hooks/useAuth";
import { TermsModal } from "@/components/TermsModal";
import { formatPhone } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const user = useSession();
  const { next } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const redirectTarget = safeNext ?? "/";
  const absoluteRedirect =
    typeof window !== "undefined" ? new URL(redirectTarget, window.location.origin).toString() : redirectTarget;

  useEffect(() => {
    if (user) {
      if (safeNext) window.location.replace(safeNext);
      else navigate({ to: "/", replace: true });
    }
  }, [user, navigate, safeNext]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error("Você precisa aceitar os Termos de Uso e Política de Privacidade (LGPD) para criar sua conta.");
      return;
    }
    const form = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: {
        emailRedirectTo: absoluteRedirect,
        data: { 
          full_name: String(form.get("full_name")),
          whatsapp: String(form.get("whatsapp")),
          accepted_terms: true,
          accepted_terms_at: new Date().toISOString(),
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu e-mail se necessário ou faça login.");
  }

  async function handleForgotPassword() {
    const emailInput = document.getElementById("si-email") as HTMLInputElement;
    const email = emailInput?.value;
    if (!email) {
      return toast.warning("Digite seu e-mail no campo para poder recuperar a senha.");
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("E-mail de recuperação enviado!");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 font-sans select-none">
      <div className="w-full max-w-[420px]">
        <div className="relative rounded-2xl border border-border bg-card p-8 shadow-2xl overflow-hidden transition-all duration-300">
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

          {!isSignUp ? (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h1 className="font-black text-3xl tracking-wide text-white uppercase font-sans">
                  MINIS<span className="text-primary">HUB</span>
                </h1>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Acesse sua conta com e-mail e senha.
                </p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="si-email"
                    className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block"
                  >
                    E-MAIL
                  </Label>
                  <Input
                    id="si-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="bg-[#eef2f7] border-none text-black h-11 px-4 focus-visible:ring-1 focus-visible:ring-primary focus-visible:text-black focus-visible:bg-white placeholder:text-muted-foreground/60 transition-colors rounded-md"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label
                      htmlFor="si-password"
                      className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block"
                    >
                      SENHA
                    </Label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[11px] font-black text-secondary hover:text-secondary/90 transition-colors uppercase tracking-wider"
                    >
                      ESQUECI A SENHA
                    </button>
                  </div>
                  <Input
                    id="si-password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="bg-[#eef2f7] border-none text-black h-11 px-4 focus-visible:ring-1 focus-visible:ring-primary focus-visible:text-black focus-visible:bg-white placeholder:text-muted-foreground/60 transition-colors rounded-md"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/95 text-white font-black text-sm tracking-wider uppercase h-11 rounded-md transition-colors border-none"
                  >
                    {loading ? "Entrando..." : "ENTRAR"}
                  </Button>
                </div>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:text-white transition-colors"
                >
                  NÃO TEM UMA CONTA?{" "}
                  <span className="text-secondary italic font-black">
                    REGISTRE-SE AQUI
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h1 className="font-black text-3xl tracking-wide text-white uppercase font-sans">
                  REGISTRE-SE
                </h1>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  PREENCHA OS DADOS PARA CRIAR SUA CONTA.
                </p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="su-name"
                    className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block"
                  >
                    NOME COMPLETO
                  </Label>
                  <Input
                    id="su-name"
                    name="full_name"
                    type="text"
                    required
                    className="bg-[#eef2f7] border-none text-black h-11 px-4 focus-visible:ring-1 focus-visible:ring-primary focus-visible:text-black focus-visible:bg-white placeholder:text-muted-foreground/60 transition-colors rounded-md"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="su-whatsapp"
                    className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block"
                  >
                    WHATSAPP
                  </Label>
                  <Input
                    id="su-whatsapp"
                    name="whatsapp"
                    type="text"
                    placeholder="Ex: +55 (11) 99999-9999"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                    required
                    className="bg-[#eef2f7] border-none text-black h-11 px-4 focus-visible:ring-1 focus-visible:ring-primary focus-visible:text-black focus-visible:bg-white placeholder:text-muted-foreground/60 transition-colors rounded-md"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="su-email"
                    className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block"
                  >
                    E-MAIL
                  </Label>
                  <Input
                    id="su-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="bg-[#eef2f7] border-none text-black h-11 px-4 focus-visible:ring-1 focus-visible:ring-primary focus-visible:text-black focus-visible:bg-white placeholder:text-muted-foreground/60 transition-colors rounded-md"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="su-password"
                    className="text-[11px] font-black text-muted-foreground uppercase tracking-wider block"
                  >
                    SENHA (MÍN. 6 CARACTERES)
                  </Label>
                  <Input
                    id="su-password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="bg-[#eef2f7] border-none text-black h-11 px-4 focus-visible:ring-1 focus-visible:ring-primary focus-visible:text-black focus-visible:bg-white placeholder:text-muted-foreground/60 transition-colors rounded-md"
                  />
                </div>

                <div className="flex items-start gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="accept_terms_auth"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    required
                    className="mt-0.5 h-4 w-4 rounded border-border bg-[#121212] text-primary focus:ring-primary cursor-pointer shrink-0"
                  />
                  <label htmlFor="accept_terms_auth" className="text-[11px] text-muted-foreground leading-snug cursor-pointer select-none">
                    Li e concordo com os{" "}
                    <button
                      type="button"
                      onClick={() => setTermsOpen(true)}
                      className="text-primary font-bold underline hover:text-primary/80"
                    >
                      Termos de Uso
                    </button>{" "}
                    e a{" "}
                    <button
                      type="button"
                      onClick={() => setTermsOpen(true)}
                      className="text-primary font-bold underline hover:text-primary/80"
                    >
                      Política de Privacidade (LGPD)
                    </button>
                    .
                  </label>
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    type="submit"
                    disabled={loading || !acceptedTerms}
                    className="w-full bg-primary hover:bg-primary/95 text-white font-black text-sm tracking-wider uppercase h-11 rounded-md transition-colors border-none disabled:opacity-50"
                  >
                    {loading ? "Criando..." : "CRIAR CONTA"}
                  </Button>
                </div>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:text-white transition-colors"
                >
                  JÁ TEM UMA CONTA?{" "}
                  <span className="text-secondary italic font-black">
                    FAÇA LOGIN AQUI
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <TermsModal
        open={termsOpen}
        onOpenChange={setTermsOpen}
        onAccept={() => setAcceptedTerms(true)}
      />
    </div>
  );
}