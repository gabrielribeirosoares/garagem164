import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { useOwnedStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Store, Sparkles } from "lucide-react";

export const Route = createFileRoute("/create-store")({
  component: CreateStore,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 40);
}

function CreateStore() {
  const navigate = useNavigate();
  const user = useSession();
  const qc = useQueryClient();
  const { data: owned, isLoading } = useOwnedStore();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [color, setColor] = useState("#f97316");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user === null) navigate({ to: "/auth", replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (owned) navigate({ to: "/admin", replace: true });
  }, [owned, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error, data } = await supabase.from("stores").insert({
      owner_id: user.id,
      name,
      slug: slug || slugify(name),
      logo_url: logoUrl || null,
      favicon_url: faviconUrl || null,
      primary_color: color,
    }).select("slug").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Loja criada!");
    await qc.invalidateQueries({ queryKey: ["owned-store"] });
    await qc.invalidateQueries({ queryKey: ["role"] });
    navigate({ to: "/admin", replace: true });
  }

  if (isLoading || user === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 space-y-5">
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-black">Crie sua loja</h1>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">Personalize a experiência da sua loja de miniaturas.</p>

        <div className="space-y-2">
          <Label>Nome da loja</Label>
          <Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} required />
        </div>
        <div className="space-y-2">
          <Label>Slug (URL)</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">/</span>
            <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required placeholder="minha-loja" />
          </div>
          <p className="text-xs text-muted-foreground">Sua loja ficará em <code>/{slug || "minha-loja"}</code></p>
        </div>
        <div className="space-y-2">
          <Label>URL do logo (opcional)</Label>
          <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="space-y-2">
          <Label>URL do favicon (opcional)</Label>
          <Input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://.../favicon.ico" />
        </div>
        <div className="space-y-2">
          <Label>Cor primária</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 rounded border border-border bg-transparent" />
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="max-w-[140px] font-mono" />
          </div>
        </div>
        <Button type="submit" disabled={saving} className="w-full font-bold" style={{ background: color, color: "#fff" }}>
          <Sparkles className="h-4 w-4 mr-2" /> {saving ? "Criando..." : "Criar loja"}
        </Button>
      </form>
    </div>
  );
}