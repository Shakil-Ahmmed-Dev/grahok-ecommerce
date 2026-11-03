import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[-0.01em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--brand-accent)] text-white shadow-2xs",
        secondary:
          "border-transparent bg-[var(--brand-ceramic)] text-[var(--foreground)]",
        destructive:
          "border-transparent bg-[var(--destructive)] text-white shadow-2xs",
        outline:
          "text-[var(--foreground)] border-[var(--border)] bg-card",
        inStock:
          "border-[var(--brand-mint)] bg-[var(--brand-mint)]/40 text-[var(--brand-accent)] dark:bg-[var(--brand-mint)]/20",
        backorder:
          "border-[var(--brand-gold-light)] bg-[var(--brand-gold-lightest)] text-[var(--brand-gold)] dark:bg-amber-950/40 dark:text-amber-300",
        outOfStock:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
        gold:
          "border-[var(--brand-gold)] bg-transparent text-[var(--brand-gold)]",
        house:
          "border-transparent bg-[var(--brand-house)] text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
