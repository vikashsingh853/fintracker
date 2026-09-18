# FinTrack

**Know your money. Plan your future.** A personal finance OS built India-first:
accounts, UPI-aware expense tracking, budgets, recurring bills, a khata (udhaar)
ledger, and a Safe-to-Spend number.

Built with Next.js 16 (App Router), TypeScript, Tailwind v4, Prisma 7 and
Supabase Postgres.

---

## Features

| Area | What it does |
| --- | --- |
| **Safe to Spend** | Liquid balance minus upcoming bills and planned savings, divided by days left in the month |
| **Salary Intelligence** | Splits a salary credit into a suggested Needs / Lifestyle / Savings / Investments / Emergency allocation |
| **Insights** | Rule-based coach: spend pace vs last month, projected budget overshoot, savings rate, bills due this week |
| **Accounts** | Bank, cash, UPI wallet, credit card, investments. Balances are always derived from the ledger, never stored |
| **Transactions** | Income, expense and transfer, grouped by day, with filters |
| **Budgets** | Per-category monthly limits with pace tracking and copy-forward |
| **Bills & Recurring** | Rent, subscriptions, SIPs and EMIs, with mark paid / mark unpaid |
| **Khata** | Who owes you and who you owe — "you will get" / "you will give" |
| **Theme** | Light / dark / system, with no flash on load |

---

## Local development

### 1. Create a Supabase project

<https://supabase.com/dashboard> → **New project**. Then open
**Project Settings → Database** and copy both connection strings.

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:

| Variable | Which Supabase string | Why |
| --- | --- | --- |
| `DATABASE_URL` | **Transaction pooler**, port `6543` | Runtime queries. Serverless needs pooling |
| `DIRECT_URL` | **Direct connection**, port `5432` | Migrations and seeding — the pooler can't run these |

Append `?pgbouncer=true` to `DATABASE_URL`.

> **Copy the host from the dashboard — don't retype it.** The pooler hostname
> encodes your project's region (for example `aws-0-ap-northeast-1`). Using the
> wrong region fails with `tenant/user ... not found`, which looks like a
> credentials problem but isn't.

### 3. Install, migrate, seed

```bash
nvm use 22
npm install          # postinstall runs `prisma generate`
npm run db:deploy    # applies prisma/migrations
npm run db:seed      # optional demo data
npm run dev
```

The seed creates a demo login — **phone `9876543210`, password `fintrack123`**.
Do not seed a production database with it.

---

## Deploying to Netlify

The app needs a hosted database: it writes on nearly every action, and even
signing in creates a `Session` row.

1. **Push to GitHub**, then in Netlify choose **Add new site → Import an
   existing project**.
2. Netlify reads [`netlify.toml`](./netlify.toml) for the build command,
   Node version and the Next.js plugin — no manual build settings needed.
3. Add the environment variables under **Site configuration → Environment
   variables**:
   - `DATABASE_URL` — pooler URL (port 6543)
   - `DIRECT_URL` — direct URL (port 5432)
4. Apply migrations once, from your machine:

   ```bash
   npm run db:deploy
   ```

5. Deploy.

### Why two URLs

Supabase's pooler (PgBouncer in transaction mode) doesn't support the prepared
statements, advisory locks and DDL transactions that `prisma migrate` needs, so
the CLI uses `DIRECT_URL`. The running app uses the pooler because serverless
functions open many short-lived connections that would otherwise exhaust
Postgres' connection limit.

---

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply existing migrations (CI / production) |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Prisma Studio |
| `npm run lint` | ESLint |

---

## Notes on the data model

- **Money is stored as integer paise** (`BigInt`), never floats, and is
  converted to a plain `number` at the data-layer boundary so `BigInt` never
  reaches a client component.
- **Account balances are derived**, not stored:
  `opening + income + transfers in − expenses − transfers out`. Credit cards
  start at zero and go negative, so the magnitude is the outstanding amount.
- **Khata is deliberately separate from the cash ledger.** Udhaar is a
  receivable or payable, not money that has moved, so it doesn't affect account
  balances or Safe to Spend.
- **Sessions are database-backed**, so a login can be revoked without rotating
  a secret.
