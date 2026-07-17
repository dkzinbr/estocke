# Estocke

Sistema de gestão de estoque e patrimônio interno — produtos, funcionários, departamentos, pedidos, mal funcionamentos e histórico de auditoria.

---

## Sumário

- [Visão geral](#visão-geral)
- [Stack](#stack)
- [Pré-requisitos](#pré-requisitos)
- [Configuração rápida](#configuração-rápida)
- [Contas de QA](#contas-de-qa)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados](#banco-de-dados)
- [Perfis de acesso](#perfis-de-acesso)
- [Módulos da aplicação](#módulos-da-aplicação)
- [Scripts](#scripts)
- [Deploy](#deploy)
- [API](#api)
- [Estrutura do projeto](#estrutura-do-projeto)

---

## Visão geral

| Capacidade | Descrição |
|---|---|
| **Produtos** | Cadastro, quantidade, estoque mínimo e status |
| **Funcionários** | Cadastro com departamento e foto opcional |
| **Departamentos** | Organização da equipe e dos usuários |
| **Pedidos** | Solicitação e atendimento de itens |
| **Mal funcionamento** | Registro, resolução e impacto no estoque |
| **Histórico** | Auditoria (admin / supervisão) |
| **Usuários** | Contas com papéis ADMIN / SUPERVISOR / EMPLOYEE |

---

## Stack

| Camada | Tecnologia |
|---|---|
| App | Next.js 16 (App Router) + React 19 |
| Estilo | Tailwind CSS 4 |
| ORM / DB | Prisma 7 + PostgreSQL |
| Auth | JWT Bearer + bcrypt |
| Validação | Zod |
| Pacotes | pnpm |

---

## Pré-requisitos

- Node.js **20+**
- pnpm **10+** (`corepack enable`)
- PostgreSQL (local ou online)

---

## Configuração rápida

```bash
pnpm install
cp .env.example .env
# preencha DATABASE_URL e JWT_SECRET

# opcional: banco online Prisma Postgres
node scripts/create-online-db.mjs

pnpm db:setup
pnpm dev
```

App: [http://localhost:3000](http://localhost:3000)

Para validar ambiente de QA de uma vez:

```bash
pnpm qa:prepare
```

---

## Contas de QA

Criadas pelo seed (`pnpm db:seed`):

| Papel | E-mail | Senha |
|---|---|---|
| ADMIN | `admin@estocke.local` | `troque-esta-senha` |
| SUPERVISOR | `supervisor@estocke.local` | `troque-esta-senha` |
| EMPLOYEE | `ana.silva@estocke.local` | `troque-esta-senha` |
| EMPLOYEE | `bruno.costa@estocke.local` | `troque-esta-senha` |

Departamentos seed: **Geral**, **TI**, **RH**. Produtos e atribuições de exemplo também são criados.

> Auto-cadastro em `/register` exige e-mail `@adcbeneficios.com.br`. Para testes de papéis, use as contas da tabela acima.

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Connection string PostgreSQL |
| `JWT_SECRET` | sim | Segredo forte (não use o placeholder) |
| `APP_URL` | sim | URL pública (ex.: `http://localhost:3000`) |
| `SEED_ADMIN_*` | não | Sobrescreve o admin do seed |

Arquivos `.env*` não vão para o Git (exceto `.env.example`).

---

## Banco de dados

| Comando | Função |
|---|---|
| `pnpm db:generate` | Gera Prisma Client (`generated/prisma`) |
| `pnpm db:migrate` | Aplica migrations |
| `pnpm db:seed` | Dados de QA |
| `pnpm db:setup` | migrate + seed |
| `pnpm db:verify` | Checagem rápida do client |

---

## Perfis de acesso

| Papel | Escopo |
|---|---|
| **ADMIN** | Tudo (catálogo, departamentos, usuários, atendimento) |
| **SUPERVISOR** | Visão ampla + histórico; ações operacionais no próprio contexto |
| **EMPLOYEE** | Pedidos/mal funcionamentos no próprio contexto |

Login: `/login` → JWT no cliente, validade **3h**.

---

## Módulos da aplicação

| Rota | Quem vê | Descrição |
|---|---|---|
| `/dashboard` | autenticados | Resumo |
| `/products` | autenticados | Estoque |
| `/employees` | autenticados | Equipe |
| `/requests` | autenticados | Pedidos |
| `/malfunctions` | autenticados | Problemas |
| `/history` | admin / supervisão | Auditoria |
| `/departments` | admin | Departamentos |
| `/users` | admin | Contas |
| `/movements` | — | Redirect legado → `/history` |

---

## Scripts

| Script | Descrição |
|---|---|
| `pnpm dev` | Desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm start` | Sobe o build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript |
| `pnpm qa:prepare` | migrate + seed + typecheck |

---

## Deploy

Checklist mínimo:

1. Definir `DATABASE_URL`, `JWT_SECRET` forte e `APP_URL` no host
2. `pnpm install`
3. `pnpm db:migrate` (e `pnpm db:seed` só se for ambiente de QA/homolog)
4. `pnpm build && pnpm start`

Observações:

- Fotos de funcionários são gravadas em `public/fotos-funcionarios` (filesystem local). Em host serverless (ex.: Vercel) use volume persistente ou storage externo antes de habilitar upload em produção.
- Front e API rodam no mesmo processo Next.js.

---

## API

Header: `Authorization: Bearer <token>`

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@estocke.local\",\"password\":\"troque-esta-senha\"}"
```

| Área | Prefixo |
|---|---|
| Auth | `/api/auth/login`, `/api/auth/register` |
| Produtos | `/api/products` |
| Funcionários | `/api/employees` |
| Departamentos | `/api/departments` |
| Pedidos | `/api/requests` |
| Mal funcionamentos | `/api/malfunctions` |
| Histórico | `/api/history` |
| Dashboard | `/api/dashboard` |
| Estoque | `/api/stockMovements` |
| Usuários | `/api/users` |

---

## Estrutura do projeto

```text
estocke/
├── lib/prisma.ts           # client Prisma (lazy)
├── prisma/                 # schema, migrations, seed
├── generated/prisma/       # client gerado (gitignored)
├── public/                 # logo + uploads
├── scripts/                # create-online-db, verify-prisma
├── src/app/                # páginas + API routes
├── src/components/
├── src/lib/                # auth, regras, activity
├── .env.example
└── README.md
```

---

## Licença

Uso interno. Ajuste conforme a política da organização.
