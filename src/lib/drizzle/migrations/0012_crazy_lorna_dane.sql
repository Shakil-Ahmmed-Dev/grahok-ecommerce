CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE INDEX "categories_name_trgm_idx" ON "categories" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "products_name_trgm_idx" ON "products" USING gin ("name" gin_trgm_ops);