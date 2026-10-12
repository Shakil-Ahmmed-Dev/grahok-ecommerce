CREATE TABLE "product_slug_redirects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"source_slug" text NOT NULL,
	"target_slug" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_slug_redirects_source_slug_unique" UNIQUE("source_slug")
);
--> statement-breakpoint
ALTER TABLE "product_slug_redirects" ADD CONSTRAINT "product_slug_redirects_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_slug_redirects_product_id_idx" ON "product_slug_redirects" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_slug_redirects_source_slug_idx" ON "product_slug_redirects" USING btree ("source_slug");--> statement-breakpoint
CREATE INDEX "product_slug_redirects_target_slug_idx" ON "product_slug_redirects" USING btree ("target_slug");