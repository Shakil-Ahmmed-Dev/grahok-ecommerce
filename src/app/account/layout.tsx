"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, Package, MapPin, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSession, signOut } from "@/lib/better-auth/client";

const ACCOUNT_NAV = [
  { href: "/account", label: "Overview", icon: User, exact: true },
  { href: "/account/orders", label: "Order History", icon: Package },
  { href: "/account/addresses", label: "Address Book", icon: MapPin },
  { href: "/account/privacy", label: "Privacy & Data", icon: Shield },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="container mx-auto px-4 py-20 flex items-center justify-center min-h-[400px]">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <User className="size-6 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign In Required</h1>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Please sign in to view your orders, address book, and account settings.
        </p>
        <Button asChild className="mt-6 w-full" size="sm">
          <Link href="/login?callbackUrl=/account">Sign In to Continue</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Account Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--saffron)]">
            Customer Dashboard
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-0.5">
            Hello, {session.user.name || "Customer"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{session.user.email}</p>
        </div>

        <Button
          onClick={() => {
            signOut();
            router.push("/");
          }}
          variant="outline"
          size="sm"
          className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive w-fit"
        >
          <LogOut className="size-3.5 mr-1.5" />
          <span>Sign Out</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Sidebar Nav */}
        <aside className="md:col-span-3">
          <nav className="flex flex-col gap-1.5 p-1 rounded-xl border border-border bg-card">
            {ACCOUNT_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Account Content */}
        <div className="md:col-span-9 min-w-0">{children}</div>
      </div>
    </div>
  );
}
