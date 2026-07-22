import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSession } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
});

const GoogleIcon = () => (
  <svg className="mr-2 h-5 w-5 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

function AuthPage() {
  const navigate = useNavigate();
  const user = useSession();
  const { next } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Only allow same-origin relative paths for the post-auth redirect.
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
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu e-mail se necessário ou faça login.");
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: absoluteRedirect,
    });
    setLoading(false);
    if (result.error) return toast.error(result.error.message);
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
          {/* Subtle red glow at top-right */}
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

          {!isSignUp ? (
            // SIGN IN FLOW
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

                  <Button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full bg-white hover:bg-gray-100 text-black font-bold text-sm h-11 rounded-md border-none flex items-center justify-center transition-colors shadow-sm"
                  >
                    <GoogleIcon />
                    Entrar com Google
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
            // SIGN UP FLOW
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
                    placeholder="Ex: (11) 99999-9999"
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

                <div className="space-y-3 pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/95 text-white font-black text-sm tracking-wider uppercase h-11 rounded-md transition-colors border-none"
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
    </div>
  );
}