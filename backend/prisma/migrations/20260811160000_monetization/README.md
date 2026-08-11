# Monetization migration

This migration adds the six monetization models' tables. It was NOT auto-generated
because `bun install` + `prisma generate` had not been run when this code was written
(Bun was not installed on the development machine).

## To generate and apply (after Bun + Docker are running)

From `backend/`:

```bash
# 1. Regenerate the Prisma client (picks up new models in schema.prisma)
bun run prisma:generate

# 2. Generate the migration SQL from the schema diff
bunx prisma migrate diff \
  --from-config-datasource \
  --to-schema=./prisma/schema.prisma \
  --script > ./prisma/migrations/20260811160000_monetization/migration.sql

# 3. Apply it (non-interactive — the documented path; `migrate dev` hangs interactively)
bun run prisma:deploy
```

## What this migration creates

- `verification_tier` enum + `vendors.verification_tier` column (+ index)
- `products.featured_until` column
- `invoice_type`, `invoice_payer_type`, `invoice_status` enums
- `invoices` table (+ indexes)
- `invoice_number_sequence` table
- `subscription_period`, `vendor_subscription_status` enums
- `subscription_plans` table
- `vendor_subscriptions` table (+ indexes)
- `lead_credit_reason` enum
- `lead_credit_ledger` table (+ indexes)
- `featured_surface`, `featured_status` enums
- `featured_placements` table (+ indexes)
- `verification_status` enum
- `verification_requests` table (+ indexes)
- `verification_document_type` enum
- `verification_documents` table (+ index)
- `broker_fee_status` enum
- `broker_fee_ledger` table (+ indexes)
- `vendor_add_on_feature`, `vendor_add_on_status` enums
- `vendor_add_ons` table (+ indexes)

Plus the new relations on `users` (`broker_fees`, `verification_reviews`,
`payment_confirmations`), `deals` (`broker_fees`, `invoices`), and
`vendors` (`subscriptions`, `lead_credit_ledger`, `verification_requests`,
`add_ons`, `featured_placements`, `invoices`).

A partial unique index `vendor_subpliers_one_active` (one non-terminal
subscription per vendor) is recommended but optional — the application layer
enforces it via `findFirst(status: pending_payment)` before create.
