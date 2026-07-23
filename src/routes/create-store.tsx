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
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [color, setColor] = useState("#f97316");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  function handleNameChange(val: string) {
    setName(val);
    if (!isCustomSlug) {
      setSlug(slugify(val));
    }
  }

  function handleSlugChange(val: string) {
    setSlug(slugify(val));
    setIsCustomSlug(true);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "favicon") {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === "logo") setUploadingLogo(true);
    else setUploadingFavicon(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id || "anonymous"}-${type}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `stores/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("images").getPublicUrl(filePath);
      if (type === "logo") setLogoUrl(data.publicUrl);
      else setFaviconUrl(data.publicUrl);

      toast.success(`${type === "logo" ? "Logo" : "Favicon"} enviado com sucesso!`);
    } catch (err: any) {
      toast.error(`Erro no upload: ${err.message}`);
    } finally {
      if (type === "logo") setUploadingLogo(false);
      else setUploadingFavicon(false);
    }
  }

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
          <Input value={name} onChange={(e) => handleNameChange(e.target.value)} required placeholder="Ex: Gabriel Minis" />
        </div>
        <div className="space-y-2">
          <Label>Slug (URL)</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">/</span>
            <Input value={slug} onChange={(e) => handleSlugChange(e.target.value)} required placeholder="gabriel-minis" />
          </div>
          <p className="text-xs text-muted-foreground">Sua loja ficará em <code>/{slug || "minha-loja"}</code></p>
        </div>
        <div className="space-y-2">
          <Label>Logo da Loja</Label>
          {logoUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/50">
              <img src={logoUrl} alt="Logo Preview" className="h-10 w-10 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Logo enviado com sucesso</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl("")} className="text-xs text-destructive hover:bg-destructive/10">Remover</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleUpload(e, "logo")}
                disabled={uploadingLogo}
                className="bg-[#121212] border-border text-foreground h-11 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/95 cursor-pointer"
              />
              {uploadingLogo && <p className="text-xs text-primary animate-pulse">Enviando logo...</p>}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Favicon da Loja (ícone da aba do navegador)</Label>
          {faviconUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/50">
              <img src={faviconUrl} alt="Favicon Preview" className="h-8 w-8 rounded object-cover animate-in fade-in" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Favicon enviado com sucesso</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setFaviconUrl("")} className="text-xs text-destructive hover:bg-destructive/10">Remover</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Input
                type="file"
                accept="image/x-icon,image/png,image/jpeg"
                onChange={(e) => handleUpload(e, "favicon")}
                disabled={uploadingFavicon}
                className="bg-[#121212] border-border text-foreground h-11 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/95 cursor-pointer"
              />
              {uploadingFavicon && <p className="text-xs text-primary animate-pulse">Enviando favicon...</p>}
            </div>
          )}
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