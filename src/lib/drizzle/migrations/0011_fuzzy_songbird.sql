CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"description" text DEFAULT '' NOT NULL,
	"imageUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_categories_product_id_category_id_pk" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
DROP INDEX "products_category_idx";--> statement-breakpoint
DROP INDEX "products_subcategory_idx";--> statement-breakpoint
ALTER TABLE "products" drop column "search_vector";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (
            setweight(
                to_tsvector(
                    'english',
                    coalesce("name", '')
                ),
                'A'
            )
            ||
            setweight(
                to_tsvector(
                    'english',
                    coalesce("shortDescription", '')
                ),
                'B'
            )
            ||
            setweight(
                to_tsvector(
                    'english',
                    coalesce("description", '')
                ),
                'C'
            )
        ) STORED;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "product_categories_product_id_idx" ON "product_categories" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_categories_category_id_idx" ON "product_categories" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "subcategory";