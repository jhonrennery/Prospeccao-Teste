# Zap2 | SQL manual adaptado

## Objetivo

Este pacote cria as tabelas `wa_*` esperadas pelo modulo Zap2 sem sobrescrever as tabelas legadas `whatsapp_*` do projeto atual.

## Por que esta adaptacao existe

O projeto atual ja possui um dominio legado de WhatsApp em `public.whatsapp_*`.

O modulo Zap2, por outro lado, foi escrito para trabalhar com:

- `public.wa_sessions`
- `public.wa_contacts`
- `public.wa_chats`
- `public.wa_messages`
- `public.wa_media`
- `public.wa_labels`
- `public.wa_chat_labels`

Forcar o Zap2 a reutilizar `whatsapp_*` agora aumentaria o acoplamento e exigiria reescrever a camada SQL do modulo. Como a meta desta integracao e isolamento, o caminho seguro e manter as tabelas tecnicas do Zap2 separadas.

## Ordem de execucao

1. `001_wa_core_tables.sql`
2. `002_wa_labels.sql`
3. `003_wa_triggers.sql`
4. `010_optional_import_from_legacy_whatsapp.sql` (somente se voce quiser aproveitar dados antigos)

## Observacoes importantes

- Os scripts usam `public` porque o modulo Zap2 atual consulta tabelas sem `schema` qualificado.
- Estes scripts nao removem nem alteram `public.whatsapp_*`.
- As tabelas `wa_*` foram mantidas sem RLS porque o modulo opera no backend via conexao direta ao banco. Se voce quiser expor isso via Supabase client no navegador, desenhe RLS separadamente.
- O schema do Zap2 assume chaves globais por `contact_jid` e `chat_jid`. Isso funciona bem para sessao unica ou ambiente pequeno. Se voce evoluir para multi-tenant forte, esse ponto merece refatoracao.
- O import opcional nao migra midias antigas para o armazenamento do Zap2. Ele preserva estrutura textual e relacionamento basico, mas nao reconstrui o storage fisico.
