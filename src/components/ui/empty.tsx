import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function Empty({
  icon,
  title,
  description,
  action,
  className,
  children,
  ...props
}: EmptyProps) {
  return (
    <div
      className={cn(
        "flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-white/60 p-8 text-center animate-in fade-in-50",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="flex size-14 items-center justify-center rounded-full bg-[var(--brand-mint)]/40 text-[var(--brand-green)] mb-4 shadow-2xs">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold tracking-tight text-[var(--brand-green)]">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-[rgba(0,0,0,0.58)] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6 flex items-center gap-3">{action}</div>}
      {children}
    </div>
  );
}
