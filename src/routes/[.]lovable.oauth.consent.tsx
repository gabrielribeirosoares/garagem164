import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type AuthDetails = {
  client?: { name?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
};

type OAuthNS = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
};

function oauth(): OAuthNS {
  return (supabase.auth as unknown as { oauth: OAuthNS }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold mb-2">Não foi possível carregar esta autorização</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const res = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (res.error) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    const target = res.data?.redirect_url ?? res.data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Nenhum redirecionamento retornado.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "um aplicativo";

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white px-4 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-black text-2xl uppercase tracking-wide">
            Conectar <span className="text-primary">{clientName}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {clientName} poderá usar suas ferramentas MinisHub como você — ver sua garagem, seus pontos e resgatar recompensas em seu nome.
          </p>
        </div>
        <ul className="text-sm text-muted-foreground space-y-1 border-t border-border pt-4">
          <li>• Ler sua garagem e histórico de carros</li>
          <li>• Ler seus saldos de pontos por loja</li>
          <li>• Listar recompensas disponíveis</li>
          <li>• Solicitar resgates de recompensas em seu nome</li>
          <li>• Ler seu histórico de resgates</li>
        </ul>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => decide(false)}
            disabled={busy}
            className="flex-1 bg-transparent border border-border text-white hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => decide(true)}
            disabled={busy}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-black uppercase"
          >
            {busy ? "..." : "Aprovar"}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Isto não substitui as permissões e políticas de segurança do MinisHub.
        </p>
      </div>
    </main>
  );
}