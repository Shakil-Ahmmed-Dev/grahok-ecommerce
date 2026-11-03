import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-[var(--input)] bg-white px-3.5 py-2 text-sm text-[var(--foreground)] tracking-[-0.01em] shadow-2xs transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--foreground-soft)] focus-visible:outline-none focus-visible:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--destructive)] aria-invalid:ring-[var(--destructive)]/20 dark:bg-card",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
