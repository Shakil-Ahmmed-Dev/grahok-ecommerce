CREATE TABLE "product_option_values" (
	"id" uuid PRIMARY KEY NOT NULL,
	"option_id" uuid NOT NULL,
	"value" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"swatch_meta" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_option_values_option_value_unique" UNIQUE("option_id","value")
);
--> statement-breakpoint
CREATE TABLE "product_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_options_product_name_unique" UNIQUE("product_id","name")
);
--> statement-breakpoint
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_product_weight_unique";--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "option_values" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "signature" text NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "inventory_type" "inventory_type" DEFAULT 'discrete' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_option_id_product_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_option_values_option_id_idx" ON "product_option_values" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "product_options_product_id_idx" ON "product_options" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_option_values_idx" ON "product_variants" USING gin ("option_values");--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "weightValue";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "weight_unit";--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_signature_unique" UNIQUE("product_id","signature");