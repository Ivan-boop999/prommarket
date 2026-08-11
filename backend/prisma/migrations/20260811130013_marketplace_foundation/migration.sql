-- CreateEnum
CREATE TYPE "attribute_type" AS ENUM ('text', 'number', 'number_range', 'select', 'multi_select', 'boolean', 'file', 'dimensions');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('new', 'used', 'refurbished', 'spare_parts', 'storage');

-- CreateEnum
CREATE TYPE "product_availability" AS ENUM ('in_stock', 'on_order');

-- CreateEnum
CREATE TYPE "price_type" AS ENUM ('fixed', 'on_request', 'volume');

-- CreateEnum
CREATE TYPE "deal_type" AS ENUM ('rfq', 'specification', 'price_proposal', 'procurement');

-- CreateEnum
CREATE TYPE "deal_status" AS ENUM ('new', 'verification', 'negotiation', 'proposal', 'connection', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "message_role" AS ENUM ('broker', 'vendor', 'buyer');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "user_role" ADD VALUE 'vendor';
ALTER TYPE "user_role" ADD VALUE 'broker';
ALTER TYPE "user_role" ADD VALUE 'buyer';
ALTER TYPE "user_role" ADD VALUE 'moderator';

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" UUID,
    "order" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "image" TEXT,
    "product_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "attribute_type" NOT NULL DEFAULT 'text',
    "unit" TEXT,
    "options" JSONB,
    "is_filterable" BOOLEAN NOT NULL DEFAULT false,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_attributes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "category_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "inherited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "category_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "oem_number" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "status" "product_status" NOT NULL DEFAULT 'new',
    "availability" "product_availability" NOT NULL DEFAULT 'in_stock',
    "lead_time" TEXT,
    "condition_note" TEXT,
    "category_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attributes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "product_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "product_id" UUID NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "type" "price_type" NOT NULL DEFAULT 'fixed',
    "price" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "includes_vat" BOOLEAN NOT NULL DEFAULT true,
    "vat_rate" INTEGER NOT NULL DEFAULT 20,
    "volume_from" INTEGER,
    "volume_to" INTEGER,
    "product_id" UUID NOT NULL,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "inn" TEXT NOT NULL,
    "ogrn" TEXT,
    "description" TEXT,
    "logo" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total_deals" INTEGER NOT NULL DEFAULT 0,
    "contact_name" TEXT,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "inn" TEXT NOT NULL,
    "ogrn" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "deal_number" TEXT NOT NULL,
    "type" "deal_type" NOT NULL,
    "status" "deal_status" NOT NULL DEFAULT 'new',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "product_id" UUID,
    "buyer_id" UUID,
    "vendor_id" UUID,
    "broker_id" UUID,
    "quantity" INTEGER,
    "delivery_date" TIMESTAMP(3),
    "delivery_address" TEXT,
    "total_amount" DECIMAL(16,2),
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "commission" DECIMAL(16,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_messages" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "deal_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "sender_role" "message_role" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_history" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "deal_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" UUID,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_number_sequence" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "deal_number_sequence_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "attributes_slug_key" ON "attributes"("slug");

-- CreateIndex
CREATE INDEX "category_attributes_attribute_id_idx" ON "category_attributes"("attribute_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_attributes_category_id_attribute_id_key" ON "category_attributes"("category_id", "attribute_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_vendor_id_idx" ON "products"("vendor_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "product_attributes_attribute_id_idx" ON "product_attributes"("attribute_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_attributes_product_id_attribute_id_key" ON "product_attributes"("product_id", "attribute_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "product_prices_product_id_idx" ON "product_prices"("product_id");

-- CreateIndex
CREATE INDEX "product_prices_type_idx" ON "product_prices"("type");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_user_id_key" ON "vendors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_inn_key" ON "vendors"("inn");

-- CreateIndex
CREATE INDEX "vendors_verified_idx" ON "vendors"("verified");

-- CreateIndex
CREATE UNIQUE INDEX "buyers_user_id_key" ON "buyers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "buyers_inn_key" ON "buyers"("inn");

-- CreateIndex
CREATE UNIQUE INDEX "deals_deal_number_key" ON "deals"("deal_number");

-- CreateIndex
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- CreateIndex
CREATE INDEX "deals_vendor_id_idx" ON "deals"("vendor_id");

-- CreateIndex
CREATE INDEX "deals_buyer_id_idx" ON "deals"("buyer_id");

-- CreateIndex
CREATE INDEX "deals_broker_id_idx" ON "deals"("broker_id");

-- CreateIndex
CREATE INDEX "deals_deal_number_idx" ON "deals"("deal_number");

-- CreateIndex
CREATE INDEX "deal_messages_deal_id_created_at_idx" ON "deal_messages"("deal_id", "created_at");

-- CreateIndex
CREATE INDEX "deal_history_deal_id_created_at_idx" ON "deal_history"("deal_id", "created_at");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_messages" ADD CONSTRAINT "deal_messages_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_history" ADD CONSTRAINT "deal_history_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

