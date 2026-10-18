ALTER TYPE "public"."inventory_type" ADD VALUE 'no_tracking';--> statement-breakpoint
CREATE TABLE "variant_type_values" (
	"id" uuid PRIMARY KEY NOT NULL,
	"variant_type_id" uuid NOT NULL,
	"value" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"swatch_meta" text,
	"default_consumption_rate" numeric,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "variant_type_values_variant_type_value_unique" UNIQUE("variant_type_id","value")
);
--> statement-breakpoint
CREATE TABLE "variant_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"default_inventory_type" "inventory_type" DEFAULT 'discrete' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "variant_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "inventory_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "inventory_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN "variant_type_id" uuid;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "pool_consumption_rate" numeric;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "pool_stock" numeric DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "variant_type_values" ADD CONSTRAINT "variant_type_values_variant_type_id_variant_types_id_fk" FOREIGN KEY ("variant_type_id") REFERENCES "public"."variant_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "variant_type_values_variant_type_id_idx" ON "variant_type_values" USING btree ("variant_type_id");--> statement-breakpoint
CREATE INDEX "variant_type_values_position_idx" ON "variant_type_values" USING btree ("position");--> statement-breakpoint
CREATE INDEX "variant_types_code_idx" ON "variant_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "variant_types_position_idx" ON "variant_types" USING btree ("position");--> statement-breakpoint
CREATE INDEX "variant_types_is_active_idx" ON "variant_types" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_variant_type_id_variant_types_id_fk" FOREIGN KEY ("variant_type_id") REFERENCES "public"."variant_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_options_variant_type_id_idx" ON "product_options" USING btree ("variant_type_id");--> statement-breakpoint
CREATE INDEX "product_variants_inventory_type_idx" ON "product_variants" USING btree ("inventory_type");--> statement-breakpoint
CREATE INDEX "products_pool_stock_idx" ON "products" USING btree ("pool_stock");--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "poolConsumptionRate";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "weight";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "weight_unit";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "weight";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "base_weight_unit";--> statement-breakpoint
DROP TYPE "public"."weight_unit";