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
                    coalesce("category", '')
                ),
                'B'
            )
            ||
            setweight(
                to_tsvector(
                    'english',
                    coalesce("subcategory", '')
                ),
                'C'
            )
        ) STORED;--> statement-breakpoint
CREATE INDEX "products_search_vector_idx" ON "products" USING gin ("search_vector");