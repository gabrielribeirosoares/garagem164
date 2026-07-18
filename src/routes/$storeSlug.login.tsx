import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSession, useRole } from "@/hooks/useAuth";
import { useStoreBySlug, setActiveStoreSlug } from "@/hooks/useStore";
import { Store } from "lucide-react";

export const Route = createFileRoute("/$storeSlug/login")({
  component: StoreLogin,
});

function StoreLogin() {
  const { storeSlug } = useParams({ from: "/$storeSlug/login" });
  const { data: store } = useStoreBySlug(storeSlug);
  const navigate = useNavigate();
  const user = useSession();
  const { data: role } = useRole();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Sync active store slug on load
  useEffect(() => {
    if (storeSlug) {
      setActiveStoreSlug(storeSlug);
    }
  }, [storeSlug]);

  useEffect(() => {
    if (user && store) {
      if (store.owner_id === user.id) {
        navigate({ to: "/admin", replace: true });
      } else {
        navigate({ to: "/garagem", replace: true });
      }
    }
  }, [user, store, navigate]);

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
    // Auto-link user to this store if not already linked
    if (store?.id) {
      await supabase.rpc("link_user_to_store", { _store_id: store.id }).catch(() => {});
    }
    toast.success("Bem-vindo!");
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: {
        emailRedirectTo: `${window.location.origin}/${storeSlug}`,
        data: { 
          full_name: String(form.get("full_name")),
          whatsapp: String(form.get("whatsapp")),
          register_store_id: store?.id
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    // If user was auto-confirmed (no email verification), link immediately
    if (signUpData?.user && store?.id) {
      await supabase.rpc("link_user_to_store", { _store_id: store.id }).catch(() => {});
    }
    toast.success("Conta criada! Verifique seu e-mail se necessário.");
  }

  async function handleGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/${storeSlug}` },
    });
    setLoading(false);
    if (error) toast.error(error.message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
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
            <Button type="button" onClick={handleGoogle} disabled={loading} variant="outline" className="w-full">
              Entrar com Google
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
              <Input name="whatsapp" placeholder="Ex: (11) 99999-9999" required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label>Senha (mín. 6)</Label>
              <Input name="password" type="password" required minLength={6} />
            </div>
            <Button type="submit" disabled={loading} className="w-full font-black" style={{ background: primary, color: "#fff" }}>
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
    </div>
  );
}