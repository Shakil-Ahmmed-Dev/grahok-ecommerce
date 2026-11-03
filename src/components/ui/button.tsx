import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-[-0.01em] transition-all duration-200 ease-out active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_[data-icon='inline-start']]:size-4 [&_[data-icon='inline-end']]:size-4 cursor-pointer select-none",
  {
    variants: {
      variant: {
        // Primary Filled - Starbucks Green Accent (#00754A)
        default:
          "bg-[var(--brand-accent)] text-white border border-[var(--brand-accent)] shadow-xs hover:bg-[#006540] hover:border-[#006540]",
        
        // Primary Outlined - Green Accent outline on light surfaces
        outline:
          "border border-[var(--brand-accent)] bg-transparent text-[var(--brand-accent)] hover:bg-[var(--brand-mint)]/30",
        
        // Dark Filled - Black (#000000) for high-contrast actions
        dark:
          "bg-black text-white border border-black hover:bg-neutral-800 hover:border-neutral-800",
        
        // Dark Outlined - Text Black outline for subtle actions
        darkOutline:
          "border border-[rgba(0,0,0,0.87)] bg-transparent text-[rgba(0,0,0,0.87)] hover:bg-black/5 dark:border-white/60 dark:text-white dark:hover:bg-white/10",
        
        // Inverted Filled - White pill on dark House Green surfaces
        inverted:
          "bg-white text-[var(--brand-accent)] border border-white hover:bg-neutral-100",
        
        // Outlined on Dark - White border and text on dark House Green surfaces
        invertedOutline:
          "border border-white/90 bg-transparent text-white hover:bg-white/15",
        
        // Secondary Ceramic pill
        secondary:
          "bg-[var(--brand-ceramic)] text-[rgba(0,0,0,0.87)] border border-transparent hover:bg-[#e2dfdb]",
        
        // Destructive
        destructive:
          "bg-[var(--destructive)] text-white border border-[var(--destructive)] hover:bg-red-700",
        
        // Ghost & Link
        ghost:
          "hover:bg-black/5 text-[rgba(0,0,0,0.87)] dark:text-white dark:hover:bg-white/10",
        link:
          "text-[var(--brand-accent)] underline-offset-4 hover:underline !p-0 !h-auto active:scale-100",
        
        // Gold / Loyalty accent
        gold:
          "bg-[var(--brand-gold)] text-white border border-[var(--brand-gold)] hover:bg-[#b89146]",
        goldOutline:
          "border border-[var(--brand-gold)] text-[var(--brand-gold)] bg-transparent hover:bg-[var(--brand-gold-lightest)]",
      },
      size: {
        default: "h-10 px-5 py-2 text-sm",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-12 px-7 text-base font-semibold",
        icon: "size-10 !p-0",
        iconSm: "size-8 !p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
