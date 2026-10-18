CREATE TABLE "customer_audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid,
	"actor_id" text,
	"actor_type" text DEFAULT 'customer' NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_audit_logs" ADD CONSTRAINT "customer_audit_logs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_audit_logs_customer_created_idx" ON "customer_audit_logs" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_audit_logs_action_idx" ON "customer_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "customer_audit_logs_actor_id_idx" ON "customer_audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "customer_audit_logs_created_at_idx" ON "customer_audit_logs" USING btree ("created_at");