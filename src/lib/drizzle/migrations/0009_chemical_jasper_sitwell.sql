CREATE TYPE "public"."product_status" AS ENUM('draft', 'published', 'archived', 'scheduled');--> statement-breakpoint
DROP INDEX "products_is_active_created_at_idx";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "status" "product_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "publishedAt" timestamp;--> statement-breakpoint
UPDATE "products" SET "status" = 'published', "publishedAt" = "createdAt" WHERE "isActive" = true;--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_published_at_idx" ON "products" USING btree ("publishedAt");