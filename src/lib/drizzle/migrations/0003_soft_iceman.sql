DROP INDEX "product_slug_idx";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "stock" SET DEFAULT 0;