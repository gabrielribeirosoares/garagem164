Instalar função reserve_tickets_batch (RPC)

1) Abra o painel SQL do Supabase (ou psql conectado ao banco):
   - Supabase: Project -> SQL Editor -> New query

2) Cole o conteúdo do arquivo `reserve_tickets_batch.sql` (ou faça upload) e execute.

3) Verifique:
   - Confirme que a função foi criada com sucesso (procure em Functions).
   - A tabela raffle_tickets deve ter a constraint única (raffle_id, number). Se não tiver, crie:
     ALTER TABLE raffle_tickets ADD CONSTRAINT raffle_tickets_raffle_id_number_key UNIQUE (raffle_id, number);

4) Teste pela aplicação:
   - Atualize o cliente (já com alterações na branch de teste) para chamar a RPC.
   - Em dois navegadores diferentes, tente reservar os mesmos números simultaneamente.
   - Observe o retorno: cada número terá status 'reserved' ou 'taken'.

5) Rollback: Para remover a função:
   DROP FUNCTION IF EXISTS public.reserve_tickets_batch(uuid, uuid, text, integer[]);

Se quiser, eu posso commitar a alteração que atualiza o front-end e criar um PR. Hoje já atualizei a branch test/paste-select-numbers com as mudanças no front-end; falta apenas executar este SQL no banco.
