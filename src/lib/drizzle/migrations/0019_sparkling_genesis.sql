ALTER TABLE "product_variants" ADD COLUMN "allow_backorder" boolean;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "allow_backorder" boolean DEFAULT false NOT NULL;