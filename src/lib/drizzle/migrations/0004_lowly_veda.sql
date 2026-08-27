CREATE INDEX "products_is_active_created_at_idx" ON "products" USING btree ("isActive","createdAt");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "products_subcategory_idx" ON "products" USING btree ("subcategory");--> statement-breakpoint
CREATE INDEX "products_sell_price_idx" ON "products" USING btree ("sellPrice");