import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useStoreBySlug } from "@/hooks/useStore";
import { setActiveStoreSlug } from "@/hooks/useStore";
import { isStoreSuspended } from "@/lib/storeStatus";
import { AlertOctagon, Lock } from "lucide-react";

export const Route = createFileRoute("/$storeSlug")({
  component: StoreLayout,
});

function StoreLayout() {
  const { storeSlug } = useParams({ from: "/$storeSlug" });
  const { data: store, isLoading } = useStoreBySlug(storeSlug);

  useEffect(() => {
    if (store?.slug) setActiveStoreSlug(store.slug);
  }, [store?.slug]);

  // Dynamic favicon + title
  useEffect(() => {
    if (!store) return;
    const prevTitle = document.title;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    const prevFavicon = link ? link.href : "/favicon.ico";

    if (store.name) document.title = store.name;
    if (store.favicon_url) {
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = store.favicon_url;
    }

    return () => {
      document.title = prevTitle;
      if (link) {
        link.href = prevFavicon;
      }
    };
  }, [store]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando loja...</div>;
  }
  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 text-center px-4">
        <h1 className="text-2xl font-black">Loja não encontrada</h1>
        <p className="text-muted-foreground text-sm">A loja "{storeSlug}" não existe ou foi removida.</p>
      </div>
    );
  }

  if (isStoreSuspended(store)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background">
        <div className="max-w-md w-full p-8 rounded-2xl border border-destructive/30 bg-destructive/5 backdrop-blur space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Loja Suspensa</h1>
          <p className="text-muted-foreground text-sm">
            A loja <strong className="text-white">{store.name}</strong> está temporariamente indisponível devido ao vencimento do plano ou suspensão de acesso.
          </p>
          <div className="pt-2 text-xs text-muted-foreground border-t border-border">
            Se você é o proprietário desta loja, entre em contato com o suporte para reativar seu acesso.
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}