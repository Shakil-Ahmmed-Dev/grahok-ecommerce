CREATE TYPE "public"."order_stage_category" AS ENUM('open', 'fulfillment', 'shipped_docked', 'in_transit', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."order_refund_rule" AS ENUM('full', 'deduct_shipping', 'deduct_flat_fee', 'deduct_percentage', 'deduct_shipping_and_fee', 'none');--> statement-breakpoint
CREATE TYPE "public"."order_restock_rule" AS ENUM('immediate', 'hold_for_inspection', 'none');--> statement-breakpoint
CREATE TYPE "public"."order_restock_status" AS ENUM('not_applicable', 'pending_inspection', 'restocked');--> statement-breakpoint
CREATE TABLE "order_statuses" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stage_category" "order_stage_category" NOT NULL,
	"allowed_next_statuses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_initial_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"allow_customer_cancel" boolean DEFAULT false NOT NULL,
	"allow_admin_cancel" boolean DEFAULT false NOT NULL,
	"refund_rule" "order_refund_rule" NOT NULL,
	"deduction_value" numeric DEFAULT '0.00',
	"restock_rule" "order_restock_rule" NOT NULL,
	"require_tracking_to_enter" boolean DEFAULT false NOT NULL,
	"auto_mark_cod_paid" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE INDEX "order_statuses_stage_category_idx" ON "order_statuses" USING btree ("stage_category");--> statement-breakpoint
CREATE INDEX "order_statuses_position_idx" ON "order_statuses" USING btree ("position");--> statement-breakpoint
CREATE INDEX "order_statuses_is_active_idx" ON "order_statuses" USING btree ("is_active");--> statement-breakpoint
INSERT INTO "order_statuses" (
	"code", "name", "description", "stage_category", "allowed_next_statuses",
	"is_initial_default", "is_active", "position", "allow_customer_cancel",
	"allow_admin_cancel", "refund_rule", "deduction_value", "restock_rule",
	"require_tracking_to_enter", "auto_mark_cod_paid"
) VALUES
('pending', 'Pending', 'Order created, awaiting confirmation or processing', 'open', '["confirmed", "processing", "cancelled"]'::jsonb, true, true, 10, true, true, 'none', '0.00', 'none', false, false),
('confirmed', 'Confirmed', 'Order verified and accepted by store, ready for fulfillment', 'open', '["processing", "cancelled"]'::jsonb, false, true, 20, true, true, 'full', '0.00', 'immediate', false, false),
('processing', 'Processing', 'Order is being picked, packed, or prepared for shipment', 'fulfillment', '["shipped", "cancelled"]'::jsonb, false, true, 30, false, true, 'full', '0.00', 'immediate', false, false),
('shipped', 'Shipped', 'Consignment handed over to courier or docked for dispatch', 'shipped_docked', '["in_transit", "delivered", "cancelled"]'::jsonb, false, true, 40, false, true, 'deduct_shipping', '0.00', 'hold_for_inspection', true, false),
('in_transit', 'In Transit', 'Order is on the way to the customer destination', 'in_transit', '["delivered", "cancelled"]'::jsonb, false, true, 50, false, true, 'deduct_shipping', '0.00', 'hold_for_inspection', true, false),
('delivered', 'Delivered', 'Order successfully delivered to customer', 'completed', '["refunded"]'::jsonb, false, true, 60, false, false, 'deduct_shipping', '0.00', 'hold_for_inspection', false, true),
('cancelled', 'Cancelled', 'Order was cancelled before completion', 'cancelled', '[]'::jsonb, false, true, 70, false, false, 'full', '0.00', 'immediate', false, false),
('refunded', 'Refunded', 'Order payment refunded and items accounted for', 'refunded', '[]'::jsonb, false, true, 80, false, false, 'full', '0.00', 'hold_for_inspection', false, false)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "policy_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_amount" numeric;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "restock_status" "order_restock_status" DEFAULT 'not_applicable' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
UPDATE "orders" SET "status" = 'pending' WHERE "status" IS NULL OR "status" NOT IN (SELECT "code" FROM "order_statuses");--> statement-breakpoint
UPDATE "orders" SET "delivered_at" = "updated_at" WHERE "status" = 'delivered' AND "delivered_at" IS NULL;--> statement-breakpoint
UPDATE "orders" SET "refunded_at" = "updated_at" WHERE "status" = 'refunded' AND "refunded_at" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_order_statuses_code_fk" FOREIGN KEY ("status") REFERENCES "public"."order_statuses"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
DROP TYPE "public"."order_status";
