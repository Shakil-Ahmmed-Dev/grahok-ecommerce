ALTER TABLE "product_variants" ADD COLUMN "weight" numeric;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "weight_unit" "weight_unit";--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight" numeric;--> statement-breakpoint
CREATE INDEX "product_variants_deleted_at_idx" ON "product_variants" USING btree ("deletedAt");--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "purchasePrice";