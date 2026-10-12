CREATE TYPE "public"."inventory_type" AS ENUM('discrete', 'shared_pool');--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "poolConsumptionRate" numeric;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "inventory_type" "inventory_type" DEFAULT 'discrete' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "base_weight_unit" "weight_unit";--> statement-breakpoint
CREATE INDEX "products_inventory_type_idx" ON "products" USING btree ("inventory_type");