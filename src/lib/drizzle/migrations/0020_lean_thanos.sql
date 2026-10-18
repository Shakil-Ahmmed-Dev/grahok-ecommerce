ALTER TABLE "product_variants" ADD COLUMN "weight" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "package_length" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "package_width" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "package_height" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "package_length" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "package_width" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "package_height" numeric(10, 2);