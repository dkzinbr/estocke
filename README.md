# Estocke

Sistema de gestão de estoque (Next.js + Prisma + PostgreSQL).

## Pré-requisitos

- Node.js 20+
- pnpm

## 1. Instalar dependências

```bash
pnpm install
```

Isso também gera o Prisma Client (`postinstall`).

## 2. Subir um banco gratuito online

Não é necessário instalar PostgreSQL na máquina. Use o **Prisma Postgres** gratuito:

```bash
node scripts/create-online-db.mjs
```

O script:

1. Cria um banco online (região `us-east-1`)
2. Grava `DATABASE_URL` no `.env`
3. Salva o link de claim em `.claim-url.txt`

Alternativa manual:

```bash
pnpm dlx create-db@latest --region us-east-1
```

Copie a connection string para o `.env` como `DATABASE_URL`.

### Manter o banco (recomendado)

Bancos criados assim **expiram em 24h**, a menos que você faça o claim:

1. Abra a URL em `.claim-url.txt` (ou a claim URL do terminal)
2. Entre na Prisma Data Platform
3. Clique em **Claim database**

Assim o banco fica gratuito e permanente.

## 3. Configurar o `.env`

Se o `.env` ainda não existir:

```bash
cp .env.example .env
```

Variáveis mínimas:

```env
DATABASE_URL="postgresql://...?sslmode=require"
JWT_SECRET="um-segredo-forte"
APP_URL="http://localhost:3000"
```

Opcionais (seed e e-mail de login):

```env
SEED_ADMIN_EMAIL="admin@estocke.local"
SEED_ADMIN_PASSWORD="troque-esta-senha"
SEED_ADMIN_NAME="Admin"

# SMTP (em development, sem SMTP o link de verificação sai no console)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Estocke <noreply@estoque.local>"
```

## 4. Rodar migrations e seed

```bash
pnpm exec prisma generate
pnpm db:migrate
pnpm db:seed
```

Ou em um comando:

```bash
pnpm db:setup
```

O seed cria o admin:

- e-mail: `admin@estocke.local`
- senha: `troque-esta-senha`

(valores sobrescritos pelas envs `SEED_ADMIN_*`, se definidas)

## 5. Subir o backend

```bash
pnpm dev
```

App em [http://localhost:3000](http://localhost:3000).

### APIs principais

| Método | Rota | Auth |
|--------|------|------|
| POST | `/api/auth/login` | pública |
| * | `/api/products` | Bearer JWT |
| * | `/api/employees` | Bearer JWT |
| * | `/api/stockMovements` | Bearer JWT |

### Fluxo de login

1. Em `/login`, informe e-mail e senha
2. A API `POST /api/auth/login` valida as credenciais e retorna o JWT
3. Use o JWT em `Authorization: Bearer <token>` (válido por **3h**)

Exemplo:

```bash
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@estocke.local\",\"password\":\"troque-esta-senha\"}"
```

## Scripts úteis

| Script | Descrição |
|--------|-----------|
| `pnpm dev` | Backend em desenvolvimento |
| `pnpm build` | Gera Prisma Client + build |
| `pnpm db:generate` | Gera Prisma Client |
| `pnpm db:migrate` | Aplica migrations |
| `pnpm db:seed` | Cria/atualiza admin |
| `pnpm db:setup` | migrate + seed |

## Stack

- Next.js 16 (App Router)
- Prisma 7 + PostgreSQL
- JWT no login (e-mail + senha)
- Zod, bcrypt
