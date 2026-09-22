ALTER TABLE "products" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
CREATE INDEX "products_deleted_at_idx" ON "products" USING btree ("deletedAt");