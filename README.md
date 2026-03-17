# ProspectAI — CRM com WhatsApp

Sistema de CRM focado em prospecção de leads com integração nativa ao WhatsApp.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend / Auth / DB:** Supabase (PostgreSQL + RLS + Edge Functions)
- **WhatsApp Gateway:** [zap2](./integrations/zap2) — Next.js, whatsapp-web.js, PostgreSQL próprio
- **Infra:** Docker Compose, Nginx (reverse proxy)

## Funcionalidades

- Dashboard com métricas de leads e conversões
- Kanban de oportunidades com drag-and-drop
- Gestão de leads com busca e filtros
- Inbox de WhatsApp com histórico de conversas, labels e envio de mensagens
- Autenticação via Supabase (sessão persistente)
- Exportação de dados

## Estrutura do projeto

```
.
├── src/
│   ├── pages/          # Rotas principais (Dashboard, Kanban, Leads, WhatsApp, ...)
│   ├── components/     # Componentes compartilhados (shadcn/ui + customizados)
│   ├── modules/        # Módulos de domínio (ex: whatsapp/)
│   ├── integrations/   # Clientes gerados (Supabase types)
│   └── lib/            # Utilitários e helpers
├── integrations/
│   └── zap2/           # Gateway WhatsApp (Next.js, standalone)
├── supabase/
│   ├── migrations/     # Migrations do banco principal
│   └── manual/         # Scripts SQL aplicados manualmente (ex: tabelas wa_*)
└── docker-compose.yml  # Orquestração completa (app + zap2 + postgres)
```

## Pré-requisitos

- Node.js >= 18
- npm >= 9
- Docker e Docker Compose (para rodar em produção ou localmente com todos os serviços)
- Projeto Supabase criado (URL + anon key)

## Configuração

Crie um arquivo `.env` na raiz com as seguintes variáveis:

```env
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<sua-anon-key>
```

## Rodando localmente

### Só o frontend

```bash
npm install
npm run dev
```

### Frontend + Gateway WhatsApp (zap2)

```bash
# Terminal 1 — frontend
npm run dev

# Terminal 2 — gateway WhatsApp
npm run dev:zap2
```

### Tudo via Docker Compose

```bash
docker compose up --build
```

Serviços expostos:
- `http://localhost:8080` — aplicação principal
- `http://localhost:3010` — gateway zap2 (direto, sem proxy)

## Banco de dados

As migrations do Supabase ficam em `supabase/migrations/` e são aplicadas via CLI:

```bash
supabase db push
```

As tabelas do WhatsApp (`wa_messages`, `wa_chats`, etc.) ficam em `supabase/manual/zap2-adapted/` e devem ser aplicadas manualmente no editor SQL do Supabase, na ordem numérica dos arquivos.

## Testes

```bash
npm test
```

## Deploy

Configure as variáveis de ambiente no servidor e rode:

```bash
docker compose up -d --build
```

O Nginx faz o proxy reverso do zap2 na rota `/zap2`.
