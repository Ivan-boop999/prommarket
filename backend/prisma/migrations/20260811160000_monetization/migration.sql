-- CreateEnum
CREATE TYPE "verification_tier" AS ENUM ('none', 'basic', 'pro');

-- CreateEnum
CREATE TYPE "invoice_type" AS ENUM ('subscription', 'lead_credits', 'featured', 'broker_fee', 'add_on');

-- CreateEnum
CREATE TYPE "invoice_payer_type" AS ENUM ('vendor', 'broker');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('draft', 'issued', 'paid', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "subscription_period" AS ENUM ('monthly', 'quarterly', 'yearly');

-- CreateEnum
CREATE TYPE "vendor_subscription_status" AS ENUM ('pending_payment', 'active', 'past_due', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "lead_credit_reason" AS ENUM ('purchase', 'admin_grant', 'rfq_unlock', 'monthly_reset', 'refund', 'subscription_grant');

-- CreateEnum
CREATE TYPE "featured_surface" AS ENUM ('category_top', 'home_featured', 'search_boost');

-- CreateEnum
CREATE TYPE "featured_status" AS ENUM ('pending', 'active', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revoked');

-- CreateEnum
CREATE TYPE "verification_document_type" AS ENUM ('inn', 'ogrn', 'license', 'iso_certificate', 'company_registration', 'other');

-- CreateEnum
CREATE TYPE "broker_fee_status" AS ENUM ('accrued', 'invoiced', 'paid', 'written_off');

-- CreateEnum
CREATE TYPE "vendor_add_on_feature" AS ENUM ('crm', 'analytics', 'api_access', 'tenders');

-- CreateEnum
CREATE TYPE "vendor_add_on_status" AS ENUM ('pending', 'active', 'disabled', 'expired');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "featured_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "verification_tier" "verification_tier" NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "number" TEXT NOT NULL,
    "type" "invoice_type" NOT NULL,
    "payerType" "invoice_payer_type" NOT NULL,
    "payer_user_id" UUID NOT NULL,
    "vendor_id" UUID,
    "subscription_id" UUID,
    "deal_id" UUID,
    "amount" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" "invoice_status" NOT NULL DEFAULT 'draft',
    "due_date" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "payment_reference" TEXT,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "notes" TEXT,
    "items" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_number_sequence" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_number_sequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "billingPeriod" "subscription_period" NOT NULL,
    "max_products" INTEGER,
    "max_regions" INTEGER,
    "included_lead_credits" INTEGER NOT NULL DEFAULT 0,
    "has_featured" BOOLEAN NOT NULL DEFAULT false,
    "has_priority_support" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "vendor_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "vendor_subscription_status" NOT NULL DEFAULT 'pending_payment',
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3),
    "amount" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "invoice_id" UUID,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_credit_ledger" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "vendor_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "lead_credit_reason" NOT NULL,
    "reference_id" TEXT,
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_placements" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "product_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "placement" "featured_surface" NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "status" "featured_status" NOT NULL DEFAULT 'pending',
    "invoice_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "featured_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "vendor_id" UUID NOT NULL,
    "status" "verification_status" NOT NULL DEFAULT 'draft',
    "requested_tier" "verification_tier" NOT NULL DEFAULT 'basic',
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "message" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_notes" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "verification_request_id" UUID NOT NULL,
    "documentType" "verification_document_type" NOT NULL,
    "file_name" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_fee_ledger" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "deal_id" UUID NOT NULL,
    "broker_id" UUID NOT NULL,
    "baseAmount" DECIMAL(16,2) NOT NULL,
    "feePercent" DECIMAL(5,2) NOT NULL,
    "feeAmount" DECIMAL(16,2) NOT NULL,
    "status" "broker_fee_status" NOT NULL DEFAULT 'accrued',
    "invoice_id" UUID,
    "accrued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broker_fee_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_add_ons" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "vendor_id" UUID NOT NULL,
    "feature" "vendor_add_on_feature" NOT NULL,
    "status" "vendor_add_on_status" NOT NULL DEFAULT 'pending',
    "activated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "invoice_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "product_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "vendor_reply" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_payer_user_id_idx" ON "invoices"("payer_user_id");

-- CreateIndex
CREATE INDEX "invoices_vendor_id_idx" ON "invoices"("vendor_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_type_idx" ON "invoices"("type");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE INDEX "subscription_plans_is_active_sort_order_idx" ON "subscription_plans"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_subscriptions_invoice_id_key" ON "vendor_subscriptions"("invoice_id");

-- CreateIndex
CREATE INDEX "vendor_subscriptions_vendor_id_idx" ON "vendor_subscriptions"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_subscriptions_status_idx" ON "vendor_subscriptions"("status");

-- CreateIndex
CREATE INDEX "lead_credit_ledger_vendor_id_created_at_idx" ON "lead_credit_ledger"("vendor_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_credit_ledger_reason_idx" ON "lead_credit_ledger"("reason");

-- CreateIndex
CREATE INDEX "featured_placements_product_id_idx" ON "featured_placements"("product_id");

-- CreateIndex
CREATE INDEX "featured_placements_status_end_at_idx" ON "featured_placements"("status", "end_at");

-- CreateIndex
CREATE INDEX "featured_placements_placement_status_idx" ON "featured_placements"("placement", "status");

-- CreateIndex
CREATE INDEX "verification_requests_status_idx" ON "verification_requests"("status");

-- CreateIndex
CREATE INDEX "verification_requests_vendor_id_idx" ON "verification_requests"("vendor_id");

-- CreateIndex
CREATE INDEX "verification_documents_verification_request_id_idx" ON "verification_documents"("verification_request_id");

-- CreateIndex
CREATE INDEX "broker_fee_ledger_broker_id_status_idx" ON "broker_fee_ledger"("broker_id", "status");

-- CreateIndex
CREATE INDEX "broker_fee_ledger_deal_id_idx" ON "broker_fee_ledger"("deal_id");

-- CreateIndex
CREATE INDEX "broker_fee_ledger_status_idx" ON "broker_fee_ledger"("status");

-- CreateIndex
CREATE INDEX "vendor_add_ons_vendor_id_feature_idx" ON "vendor_add_ons"("vendor_id", "feature");

-- CreateIndex
CREATE INDEX "vendor_add_ons_status_idx" ON "vendor_add_ons"("status");

-- CreateIndex
CREATE INDEX "product_reviews_product_id_idx" ON "product_reviews"("product_id");

-- CreateIndex
CREATE INDEX "product_reviews_author_id_idx" ON "product_reviews"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_reviews_product_id_author_id_key" ON "product_reviews"("product_id", "author_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "vendors_verification_tier_idx" ON "vendors"("verification_tier");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_subscriptions" ADD CONSTRAINT "vendor_subscriptions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_subscriptions" ADD CONSTRAINT "vendor_subscriptions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_subscriptions" ADD CONSTRAINT "vendor_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_credit_ledger" ADD CONSTRAINT "lead_credit_ledger_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_placements" ADD CONSTRAINT "featured_placements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_placements" ADD CONSTRAINT "featured_placements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_placements" ADD CONSTRAINT "featured_placements_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_verification_request_id_fkey" FOREIGN KEY ("verification_request_id") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_fee_ledger" ADD CONSTRAINT "broker_fee_ledger_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_fee_ledger" ADD CONSTRAINT "broker_fee_ledger_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_fee_ledger" ADD CONSTRAINT "broker_fee_ledger_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_add_ons" ADD CONSTRAINT "vendor_add_ons_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_add_ons" ADD CONSTRAINT "vendor_add_ons_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

