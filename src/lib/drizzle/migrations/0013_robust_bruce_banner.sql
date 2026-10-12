CREATE TYPE "public"."weight_unit" AS ENUM('g', 'kg', 'mg', 'ml', 'l', 'oz', 'lb', 'pcs');--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"title" text NOT NULL,
	"weightValue" numeric NOT NULL,
	"weight_unit" "weight_unit" NOT NULL,
	"sku" text NOT NULL,
	"purchasePrice" numeric NOT NULL,
	"sellPrice" numeric NOT NULL,
	"stock" numeric DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"imageUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku"),
	CONSTRAINT "product_variants_product_weight_unique" UNIQUE("product_id","weightValue","weight_unit")
);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_sku_idx" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_variants_product_active_idx" ON "product_variants" USING btree ("product_id","is_active");