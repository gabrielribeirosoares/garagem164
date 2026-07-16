# Refatoração Multi-Tenant (White Label)

## 1. Banco de dados (uma migration)

Nova tabela **`stores`**:
- `owner_id` → auth.users
- `name`, `slug` (único), `logo_url`, `favicon_url`, `primary_color`

Nova tabela **`customer_points`** (saldo por cliente por loja):
- `user_id`, `store_id`, `points` — unique (user_id, store_id)

Adicionar `store_id NOT NULL` (FK stores) em: **cars, rewards, redemptions**.

Ajustar triggers existentes:
- `on_car_insert`/`on_car_delete`: mexer em `customer_points` (user_id + store_id), não mais em `profiles.points`.
- `on_redemption_insert`/`on_redemption_update`: idem — validar/descontar/reembolsar sobre `customer_points`.
- `handle_new_user`: continua criando profile; não atribui role automaticamente (role vira contextual: dono se `stores.owner_id = uid`, cliente caso contrário).

RLS:
- `stores`: SELECT público (anon+authenticated); INSERT/UPDATE/DELETE somente owner.
- `cars`, `rewards`, `redemptions`: dono da loja gerencia tudo da própria loja; cliente lê/cria os próprios registros dentro daquela loja.
- `customer_points`: cliente lê o próprio; dono lê todos da sua loja; escrita só via triggers (service_role).
- Remover policies antigas baseadas em `has_role(admin)` global.

`user_roles` fica no schema mas deixa de ser usado no fluxo (mantido para não quebrar tipos).

## 2. Rotas

Públicas (novas):
- `/create-store` — signup de dono; formulário name/slug/logos/cor.
- `/:storeSlug` — landing white-label da loja.
- `/:storeSlug/login` — login/signup de cliente daquela loja.

Autenticadas (mantidas globais, como você pediu):
- `/admin` detecta automaticamente `stores.owner_id = uid`. Se não tem loja → redireciona `/create-store`.
- `/garagem`, `/recompensas`: precisam de `?store=<slug>` (ou último store visitado em localStorage) porque cliente pode pertencer a várias lojas. Menu no topo troca de loja.

Landing raiz `/` vira página institucional "crie sua loja" (CTA → `/create-store`).

## 3. Contexto e wrapper white-label

- `useStoreBySlug(slug)`: query pública em `stores`.
- `PublicStoreLayout` (rota `/:storeSlug`): carrega a loja, injeta no contexto React, atualiza `<title>` e `<link rel=icon>` via `useEffect`, aplica `primary_color` como CSS var `--store-primary`.
- Botões principais usam `style={{ background: 'var(--store-primary)' }}` quando dentro do contexto da loja.
- Se `logo_url` nulo → renderiza `name` estilizado no header.

## 4. Painel admin

- Hook `useOwnedStore()` → busca `stores` onde `owner_id = uid`.
- Todas as queries admin (carros, recompensas, resgates, clientes) filtram por `store_id`.
- Inserções recebem `store_id` automaticamente.
- Dashboard mostra nome/logo da loja + link "ver loja pública" (`/:slug`).

## 5. Auth com preservação de contexto

- Formulário de login em `/:storeSlug/login` guarda o slug no state; após `signIn` navega para `/:storeSlug`.
- Google OAuth: `redirect_uri = ${origin}/auth/callback?store=<slug>`; a rota callback lê o param e redireciona.
- Signup em `/:storeSlug/login` marca o novo user como cliente daquela loja (cria linha em `customer_points` com 0 e — se necessário — associa perfil).

## Detalhes técnicos

- Migration única com CREATE + GRANT + RLS + policies + refactor de triggers, em ordem.
- Novos arquivos: `src/routes/create-store.tsx`, `src/routes/$storeSlug.tsx` (layout), `src/routes/$storeSlug.index.tsx` (landing), `src/routes/$storeSlug.login.tsx`, `src/routes/auth.callback.tsx`, `src/hooks/useStore.ts`, `src/lib/store-context.tsx`.
- Editados: admin routes (adicionar filtro por store_id), `garagem.tsx`/`recompensas.tsx` (aceitar store via param), `route.tsx` layout autenticado (seletor de loja no header), `index.tsx` (nova landing institucional), `styles.css` (var `--store-primary`).
- Regeneração de tipos Supabase acontece após aprovação da migration; código que depende de novas colunas vai depois.

## Fora de escopo

- Domínio custom por loja (subdomínio/CNAME). Só slug no path.
- Convites de cliente por email. Cliente entra fazendo signup em `/:slug/login`.
- Multi-role dentro de uma loja (staff, etc.). Só dono + clientes.

Confirma esse plano que eu executo — começando pela migration.
