# Estocke

Sistema de gestão de estoque e patrimônio interno: produtos, funcionários, departamentos, pedidos, maus funcionamentos e histórico de auditoria.

**Demo:** [estocke-adc.vercel.app](https://estocke-adc.vercel.app) · projeto de demonstração, sem dados reais.

O Estocke é a evolução de dois protótipos anteriores: o **OperaPlan** (comunicação e chamados entre equipes) e o **inventory** (Next.js + Strapi). Aqui as ideias viraram uma plataforma única de pedidos, chamados de mau funcionamento e controle de estoque, com perfis de acesso e trilha de auditoria.

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
| **Mau funcionamento** | Registro, resolução e impacto no estoque |
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

### 1. Dependências

```bash
pnpm install
```

### 2. Ambiente

```bash
cp .env.example .env
pnpm env:secret -- --write
```

Defina `DATABASE_URL` no `.env` (PostgreSQL).  
Alternativa sem Postgres local:

```bash
node scripts/create-online-db.mjs
```

O script grava `DATABASE_URL` e, se faltar, um `JWT_SECRET` aleatório.  
Bancos criados assim expiram em 24h — abra a URL em `.claim-url.txt` e faça o **Claim**.

### 3. Banco + dados iniciais

```bash
pnpm db:setup
```

Isso aplica migrations e o seed de QA (contas, departamentos, produtos).

### 4. Subir a aplicação

```bash
pnpm dev
```

App: [http://localhost:3000](http://localhost:3000)

Checklist único para homologação:

```bash
pnpm qa:prepare
```

---

## Contas de QA

Criadas pelo seed (`pnpm db:seed` / `pnpm db:setup`):

| Papel | E-mail | Senha |
|---|---|---|
| ADMIN | `admin@estocke.local` | `SEED_ADMIN_PASSWORD` |
| SUPERVISOR | `supervisor@estocke.local` | `SEED_DEMO_PASSWORD` |
| EMPLOYEE | `ana.silva@estocke.local` | `SEED_DEMO_PASSWORD` |
| EMPLOYEE | `bruno.costa@estocke.local` | `SEED_DEMO_PASSWORD` |

As senhas não ficam no código: defina as duas variáveis no `.env` antes de rodar o seed.

Departamentos seed: **Geral**, **TI**, **RH**. Também há produtos, atribuições e um notebook único para cenários de patrimônio.

> Contas são criadas pelo **admin** em Funcionários (senha inicial padrão; alteração obrigatória no 1º login). `/register` está desativado.

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Connection string PostgreSQL |
| `JWT_SECRET` | sim | Segredo criptográfico — gere com `pnpm env:secret` |
| `APP_URL` | sim | URL pública (ex.: `http://localhost:3000`) |
| `DEFAULT_USER_PASSWORD` | sim | Senha inicial dos funcionários criados pelo admin (troca obrigatória no 1º login) |
| `SEED_ADMIN_EMAIL` | não | E-mail do admin no seed |
| `SEED_ADMIN_PASSWORD` | seed | Senha do admin no seed |
| `SEED_DEMO_PASSWORD` | seed | Senha das contas de demonstração do seed |
| `SEED_ADMIN_NAME` | não | Nome do admin no seed |

Arquivos `.env*` **não** entram no Git (exceto `.env.example`).

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
| **EMPLOYEE** | Pedidos/maus funcionamentos no próprio contexto |

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
| `pnpm env:secret` | Gera JWT_SECRET forte (use `-- --write` para gravar no `.env`) |
| `pnpm qa:prepare` | migrate + seed + typecheck |

---

## Deploy

### Vercel

No projeto → **Settings → Environment Variables**, marque **Production**, **Preview** e **Development** e adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | a mesma connection string do seu `.env` local |
| `JWT_SECRET` | `pnpm env:secret` |
| `APP_URL` | URL do app (ex.: `https://estocke-adc.vercel.app`) |

Ou, com o projeto linkado (`pnpm dlx vercel link`):

```bash
node scripts/vercel-set-env.mjs
# se o deploy for no projeto estocke-adc:
node scripts/vercel-set-env.mjs --project=estocke-adc
```

Depois faça **Redeploy**. O erro `DATABASE_URL is not configured.` some quando a variável existe nas três abas.

Antes do primeiro acesso em produção, rode as migrations no banco (localmente apontando para o mesmo `DATABASE_URL`):

```bash
pnpm db:migrate
# opcional em homolog:
pnpm db:seed
```

### Checklist geral

1. Definir `DATABASE_URL`, `JWT_SECRET` forte e `APP_URL` no host
2. `pnpm install`
3. `pnpm db:migrate` (e `pnpm db:seed` só se for QA/homolog)
4. `pnpm build && pnpm start`

Observações:

- Fotos de funcionários vão para `public/fotos-funcionarios` (disco local). Na Vercel o filesystem é efêmero — use storage externo se precisar de upload em produção.
- Front e API rodam no mesmo processo Next.js.

---

## API

Header: `Authorization: Bearer <token>`

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@estocke.local\",\"password\":\"<sua-senha>\"}"
```

| Área | Prefixo |
|---|---|
| Auth | `/api/auth/login`, `/api/auth/change-password` |
| Produtos | `/api/products` |
| Funcionários | `/api/employees` |
| Departamentos | `/api/departments` |
| Pedidos | `/api/requests` |
| Maus funcionamentos | `/api/malfunctions` |
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
