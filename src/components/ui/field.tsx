import * as React from "react";
import { cn } from "@/lib/utils";

export type FieldGroupProps = React.HTMLAttributes<HTMLDivElement>;

export function FieldGroup({ className, ...props }: FieldGroupProps) {
  return <div className={cn("flex flex-col gap-4", className)} {...props} />;
}

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  invalid?: boolean;
}

export function Field({ className, invalid, ...props }: FieldProps) {
  return (
    <div
      data-invalid={invalid ? "true" : undefined}
      className={cn("flex flex-col gap-1.5 group", className)}
      {...props}
    />
  );
}

export interface FieldLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function FieldLabel({ className, required, children, ...props }: FieldLabelProps) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 group-data-[invalid=true]:text-destructive",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
  );
}

export type FieldDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export function FieldDescription({ className, ...props }: FieldDescriptionProps) {
  return (
    <p
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export interface FieldErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  message?: string;
}

export function FieldError({ className, message, children, ...props }: FieldErrorProps) {
  const content = message || children;
  if (!content) return null;
  return (
    <p
      role="alert"
      className={cn("text-xs font-medium text-destructive", className)}
      {...props}
    >
      {content}
    </p>
  );
}
