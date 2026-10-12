ALTER TABLE "products" ADD COLUMN "shortDescription" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "search_vector";--> statement-breakpoint
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
                    coalesce("category", '') || ' ' || coalesce("subcategory", '')
                ),
                'B'
            )
            ||
            setweight(
                to_tsvector(
                    'english',
                    coalesce("shortDescription", '')
                ),
                'C'
            )
            ||
            setweight(
                to_tsvector(
                    'english',
                    coalesce("description", '')
                ),
                'D'
            )
        ) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_search_vector_idx" ON "products" USING gin ("search_vector");