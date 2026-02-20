# Invoice Recovery Copilot

Guided invoice dispute auto-resolver for freelancers and small teams.

Built with:
- Next.js 16 + App Router
- Supabase (Postgres/Auth/Storage)
- Stripe Checkout + Portal
- Twilio SMS
- Vercel deployment target

## What is implemented

- Beautiful multi-page product UX
- Landing page (`/`)
- 5-step onboarding wizard (`/onboarding`)
- Recovery dashboard (`/dashboard`)
- Invoice detail + timeline + legal packet generation (`/invoices/[id]`)
- Template studio + optional AI tone rewrite (`/templates`)
- Supabase-first backend with local mock fallback when env is missing
- Invoice, escalation, legal packet, billing, templates, and webhook API routes
- Database schema migration for core entities and RLS placeholders

## API surface

- `GET /api/invoices`
- `POST /api/invoices`
- `GET /api/invoices/:id`
- `POST /api/invoices/import-csv`
- `POST /api/escalations/:invoiceId/preview-step`
- `POST /api/escalations/:invoiceId/approve-step`
- `POST /api/escalations/:invoiceId/pause`
- `POST /api/escalations/:invoiceId/mark-paid`
- `POST /api/legal-packets/:invoiceId/generate`
- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `GET /api/templates`
- `POST /api/templates/rewrite`
- `POST /api/webhooks/stripe`
- `POST /api/webhooks/twilio`

## Local setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env.local
```

3. Add Supabase and provider keys in `.env.local`.
   - For authenticated API access with RLS, include `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Service-role key remains server-only and is used as fallback when no user token is present.

4. Run development server:
```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Supabase schema

Migration file:
- `supabase/migrations/0001_invoice_recovery_schema.sql`

Apply it with your preferred Supabase workflow (local CLI or remote SQL editor).

## Build and quality checks

```bash
npm run lint
npm run build
```

Both currently pass.

## Deploy to Vercel

1. Import repo in Vercel.
2. Set environment variables from `.env.example`.
3. Set production `NEXT_PUBLIC_APP_URL`.
4. Configure webhook endpoints:
- Stripe -> `/api/webhooks/stripe`
- Twilio -> `/api/webhooks/twilio`
5. Deploy.

## Notes

- If Supabase env vars are missing, the app uses an in-memory fallback store so flows still work in local demo mode.
- API routes accept Supabase bearer tokens (or Supabase auth cookies) and will run repository calls through an RLS-scoped user client when available.
- Stripe/Twilio also run in mock mode when not configured.
- The product is intentionally conservative in legal tone and includes template-level disclaimer language.
