CREATE TYPE "public"."address_type" AS ENUM('shipping', 'billing', 'both');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."customer_type" AS ENUM('registered', 'guest');--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"recipient_name" text NOT NULL,
	"company" text,
	"phone" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" text,
	"postal_code" text NOT NULL,
	"country_code" text NOT NULL,
	"address_type" "address_type" DEFAULT 'both' NOT NULL,
	"is_default_shipping" boolean DEFAULT false NOT NULL,
	"is_default_billing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"auth_user_id" text,
	"customer_type" "customer_type" DEFAULT 'registered' NOT NULL,
	"status" "customer_status" DEFAULT 'active' NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"avatar_url" text,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"admin_notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric DEFAULT '0.00' NOT NULL,
	"last_order_at" timestamp,
	"is_anonymized" boolean DEFAULT false NOT NULL,
	"anonymized_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "customers_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_addresses_deleted_at_idx" ON "customer_addresses" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_addresses_unique_default_shipping" ON "customer_addresses" USING btree ("customer_id") WHERE "customer_addresses"."is_default_shipping" = true AND "customer_addresses"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_addresses_unique_default_billing" ON "customer_addresses" USING btree ("customer_id") WHERE "customer_addresses"."is_default_billing" = true AND "customer_addresses"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_auth_user_id_idx" ON "customers" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "customers_status_type_created_idx" ON "customers" USING btree ("status","customer_type","created_at");--> statement-breakpoint
CREATE INDEX "customers_deleted_at_idx" ON "customers" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "customers_email_trgm_idx" ON "customers" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customers_first_name_trgm_idx" ON "customers" USING gin ("first_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customers_last_name_trgm_idx" ON "customers" USING gin ("last_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customers_phone_trgm_idx" ON "customers" USING gin ("phone" gin_trgm_ops);