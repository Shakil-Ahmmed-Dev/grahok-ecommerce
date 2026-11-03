"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { signIn, signUp, useSession } from "@/lib/better-auth/client";

export const dynamic = "force-dynamic";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/account";

  const { data: session } = useSession();

  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // If already logged in, redirect
  React.useEffect(() => {
    if (session?.user) {
      router.push(callbackUrl);
    }
  }, [session, router, callbackUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signin") {
        const res = await signIn.email({
          email: email.trim(),
          password,
        });

        if (res.error) {
          setErrorMessage(res.error.message || "Invalid credentials. Please verify and try again.");
          setLoading(false);
          return;
        }

        router.push(callbackUrl);
      } else {
        if (!name.trim()) {
          setErrorMessage("Please provide your full name.");
          setLoading(false);
          return;
        }

        const res = await signUp.email({
          email: email.trim(),
          password,
          name: name.trim(),
        });

        if (res.error) {
          setErrorMessage(res.error.message || "Failed to create account. Please try again.");
          setLoading(false);
          return;
        }

        router.push(callbackUrl);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred during authentication."
      );
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-8 shadow-starbucks-card">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--brand-mint)]/40 text-[var(--brand-green)] mb-3 shadow-2xs">
          <Lock className="size-5" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--brand-green)]">
          {mode === "signin" ? "Welcome Back" : "Create an Account"}
        </h1>
        <p className="text-xs text-[rgba(0,0,0,0.58)] mt-1.5 leading-relaxed">
          {mode === "signin"
            ? "Sign in to access your order history, tracking, and saved address book."
            : "Register to manage orders, save delivery locations, and checkout seamlessly."}
        </p>
      </div>

      {/* Tab Switcher - Full-pill container (.agents/DESIGN.md Section 4) */}
      <div className="grid grid-cols-2 rounded-full bg-[var(--brand-ceramic)] p-1 mb-6 text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setErrorMessage(null);
          }}
          className={`py-2 rounded-full transition-all cursor-pointer ${
            mode === "signin"
              ? "bg-white text-[var(--brand-green)] font-bold shadow-2xs"
              : "text-[rgba(0,0,0,0.58)] hover:text-[rgba(0,0,0,0.87)]"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setErrorMessage(null);
          }}
          className={`py-2 rounded-full transition-all cursor-pointer ${
            mode === "signup"
              ? "bg-white text-[var(--brand-green)] font-bold shadow-2xs"
              : "text-[rgba(0,0,0,0.58)] hover:text-[rgba(0,0,0,0.87)]"
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="rounded-xl border border-[var(--destructive)]/20 bg-red-50 p-3 text-xs text-[var(--destructive)] flex items-start gap-2 mb-4">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          {mode === "signup" && (
            <Field>
              <FieldLabel required>Full Name</FieldLabel>
              <Input
                type="text"
                placeholder="e.g. Shakil Ahmmed"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </Field>
          )}

          <Field>
            <FieldLabel required>Email Address</FieldLabel>
            <Input
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </Field>

          <Field>
            <FieldLabel required>Password</FieldLabel>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </Field>

          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="w-full h-12 text-sm font-semibold mt-3"
          >
            {loading ? (
              <>
                <Spinner data-icon="inline-start" className="mr-2" />
                <span>{mode === "signin" ? "Signing In..." : "Creating Account..."}</span>
              </>
            ) : (
              <>
                <span>{mode === "signin" ? "Sign In" : "Register Account"}</span>
                <ArrowRight className="size-4 ml-1.5" />
              </>
            )}
          </Button>
        </FieldGroup>
      </form>

      <div className="mt-6 pt-6 border-t border-[var(--border)] text-center text-xs text-[rgba(0,0,0,0.58)]">
        <span>By signing in, you agree to Grahok&apos;s </span>
        <span className="text-[var(--brand-green)] font-semibold underline">Terms of Service</span>
        <span> and </span>
        <span className="text-[var(--brand-green)] font-semibold underline">Privacy Policy</span>.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="container mx-auto px-4 py-16 sm:py-24 flex items-center justify-center min-h-[600px]">
      <Suspense fallback={<Spinner className="size-8 text-[var(--brand-accent)]" />}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}
