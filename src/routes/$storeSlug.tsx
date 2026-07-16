import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useStoreBySlug } from "@/hooks/useStore";
import { setActiveStoreSlug } from "@/hooks/useStore";

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

  return <Outlet />;
}