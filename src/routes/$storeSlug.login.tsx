import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSession, useRole } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";
import { useStoreBySlug, setActiveStoreSlug } from "@/hooks/useStore";
import { Store, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { TermsModal } from "@/components/TermsModal";
import { formatPhone, getPhoneFlag } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/$storeSlug/login")({
  component: StoreLogin,
});

function StoreLogin() {
  const { storeSlug } = useParams({ from: "/$storeSlug/login" });
  const navigate = useNavigate();
  const user = useSession();
  const { data: role } = useRole();
  const { theme, setTheme } = useTheme();
  const { data: store } = useStoreBySlug(storeSlug);

  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    if (user && role) {
      setActiveStoreSlug(storeSlug);
      navigate({ to: "/garagem" });
    }
  }, [user, role, storeSlug, navigate]);

  const primary = store?.primary_color || "#f97316";

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
    setActiveStoreSlug(storeSlug);
    toast.success("Bem-vindo!");
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error("Você precisa aceitar os Termos de Uso e Política de Privacidade para criar sua conta.");
      return;
    }
    const form = new FormData(e.currentTarget);
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: {
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
    toast.success("Conta criada! Verifique seu e-mail se necessário.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4 relative transition-colors duration-300">
      <div className="absolute top-4 right-4 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="Tema (Claro / Escuro / Automático)">
              {theme === "light" ? (
                <Sun className="h-5 w-5 text-amber-500" />
              ) : theme === "dark" ? (
                <Moon className="h-5 w-5 text-blue-400" />
              ) : (
                <Monitor className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
            <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Tema da Aplicação
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={() => setTheme("light")}
              className={`cursor-pointer gap-2 ${theme === "light" ? "font-bold text-primary" : ""}`}
            >
              <Sun className="h-4 w-4 text-amber-500" /> Tema Diurno (Claro)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("dark")}
              className={`cursor-pointer gap-2 ${theme === "dark" ? "font-bold text-primary" : ""}`}
            >
              <Moon className="h-4 w-4 text-blue-400" /> Tema Noturno (Escuro)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("system")}
              className={`cursor-pointer gap-2 ${theme === "system" ? "font-bold text-primary" : ""}`}
            >
              <Monitor className="h-4 w-4 text-muted-foreground" /> Automático (do Computador)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          {store?.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-14 w-14 mx-auto rounded object-cover" />
          ) : (
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-xl bg-primary/10" style={{ color: primary }}>
              <Store className="h-8 w-8" />
            </div>
          )}
          <h1 className="font-black text-2xl uppercase">
            {store?.name ? (
              <>
                {store.name.split(" ")[0]}
                {store.name.split(" ").slice(1).length > 0 && (
                  <span style={{ color: primary }}> {store.name.split(" ").slice(1).join(" ")}</span>
                )}
              </>
            ) : (
              storeSlug
            )}
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {isSignUp ? "Crie sua conta" : "Acesse sua garagem"}
          </p>
        </div>

        {!isSignUp ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input name="password" type="password" required />
            </div>
            <Button type="submit" disabled={loading} className="w-full font-black" style={{ background: primary, color: "#fff" }}>
              {loading ? "Entrando..." : "ENTRAR"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input name="full_name" required />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg pointer-events-none select-none z-10">
                  {getPhoneFlag(whatsapp)}
                </span>
                <Input
                  name="whatsapp"
                  placeholder="Ex: (11) 99999-9999 ou +1 555 1234"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                  required
                  className="pl-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label>Senha (mín. 6)</Label>
              <Input name="password" type="password" required minLength={6} />
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="accept_terms_store"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 rounded border-border bg-[#121212] text-primary focus:ring-primary cursor-pointer shrink-0"
              />
              <label htmlFor="accept_terms_store" className="text-[11px] text-muted-foreground leading-snug cursor-pointer select-none">
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

            <Button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="w-full font-black disabled:opacity-50"
              style={{ background: primary, color: "#fff" }}
            >
              {loading ? "Criando..." : "CRIAR CONTA"}
            </Button>
          </form>
        )}

        <div className="text-center">
          <button type="button" onClick={() => setIsSignUp((v) => !v)} className="text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground">
            {isSignUp ? "Já tem conta? Entrar" : "Não tem conta? Registre-se"}
          </button>
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