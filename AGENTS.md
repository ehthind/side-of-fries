# AGENTS.md

## Product Context
- Product: Invoice Recovery Copilot
- Stack: Next.js (Vercel), Supabase (Postgres/Auth/Storage), Stripe, Twilio
- Goal: Help freelancers and small teams recover unpaid invoices with guided escalation and legal-template generation.

## Architecture Decisions
- Use App Router API routes for all backend endpoints.
- Keep a Supabase-first repository layer with an in-memory local fallback so development runs without external services.
- Build a single workspace demo flow by default (`demo-workspace`) until full auth/workspace switching is wired.
- Keep escalation conservative and approval-gated at every step.

## Engineering Conventions
- All money is stored as integer cents.
- Escalation stages are strict enum order: `polite_nudge -> firm_follow_up -> collections_warning -> small_claims_template`.
- Every mutation writes an audit/event trail.
- Route handlers validate payloads with `zod`.

## Session Work Log
- 2026-02-20: Initialized Next.js project and installed core dependencies.
- 2026-02-20: Started backend foundation (schema, repository, API contracts).
- 2026-02-20: Committed backend/API foundation as `feat: scaffold backend and recovery APIs`.
- 2026-02-20: Implemented Supabase schema migration and Supabase-first repository with local fallback mode.
- 2026-02-20: Added invoice, escalation, legal packet, template, billing, and webhook API routes.
- 2026-02-20: Shipped frontend experience: landing page, onboarding wizard, dashboard, invoice timeline, and template studio.
- 2026-02-20: Verified `npm run lint` and `npm run build` pass.
