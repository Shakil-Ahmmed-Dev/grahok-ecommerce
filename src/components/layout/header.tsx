"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, User, Menu, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SearchAutocomplete } from "./search-autocomplete";
import { useCart } from "@/context/cart-context";
import { useSession, signOut } from "@/lib/better-auth/client";
import type { TCategoryTreeNode } from "@/features/categories/types";

interface HeaderProps {
  categories?: TCategoryTreeNode[];
}

export function Header({ categories = [] }: HeaderProps) {
  const pathname = usePathname();
  const { itemCount, openCart, isMounted } = useCart();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Close user dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const topCategories = categories.slice(0, 5);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-white/95 backdrop-blur-md shadow-starbucks-nav">
      {/* Top Utility Strip */}
      <div className="bg-[var(--brand-house)] text-white px-4 py-1.5 text-center text-xs font-medium tracking-tight">
        <span>Curated Everyday Goods &middot; Fast Nationwide Doorstep Delivery</span>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between gap-4">
          {/* Mobile menu trigger */}
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="iconSm" aria-label="Open navigation menu">
                  <Menu className="size-5 text-[rgba(0,0,0,0.87)]" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[310px] p-6 bg-[var(--brand-cream)]">
                <SheetHeader className="text-left border-b border-[var(--border)] pb-4">
                  <SheetTitle className="font-bold text-2xl tracking-tighter text-[var(--brand-green)]">
                    GRAHOK
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-2 mt-6">
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-base font-semibold text-[rgba(0,0,0,0.87)] hover:text-[var(--brand-accent)] transition-colors py-1.5"
                  >
                    Home
                  </Link>
                  <Link
                    href="/products"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-base font-semibold text-[rgba(0,0,0,0.87)] hover:text-[var(--brand-accent)] transition-colors py-1.5"
                  >
                    All Catalog
                  </Link>

                  {topCategories.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-col gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-green)]">
                        Featured Departments
                      </span>
                      {topCategories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/categories/${cat.slug}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="text-sm font-medium text-[rgba(0,0,0,0.87)] hover:text-[var(--brand-accent)] transition-colors py-1"
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t border-[var(--border)] flex flex-col gap-2">
                    {session?.user ? (
                      <>
                        <Link
                          href="/account"
                          onClick={() => setMobileMenuOpen(false)}
                          className="text-sm font-semibold text-[var(--brand-green)] hover:text-[var(--brand-accent)] transition-colors py-1"
                        >
                          Account Dashboard
                        </Link>
                        <button
                          onClick={() => {
                            setMobileMenuOpen(false);
                            signOut();
                          }}
                          className="text-left text-sm font-semibold text-[var(--destructive)] hover:underline py-1 cursor-pointer"
                        >
                          Sign Out
                        </button>
                      </>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-sm font-semibold text-[var(--brand-accent)] hover:underline py-1"
                      >
                        Sign In / Register
                      </Link>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* Brand Wordmark Logo */}
          <Link href="/" className="flex items-center gap-1 shrink-0 group">
            <span className="font-extrabold text-2xl tracking-tighter text-[var(--brand-green)] transition-colors">
              GRAHOK
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold tracking-[-0.01em]">
            <Link
              href="/products"
              className={`transition-colors hover:text-[var(--brand-accent)] ${
                pathname === "/products"
                  ? "text-[var(--brand-green)] border-b-2 border-[var(--brand-green)] pb-0.5"
                  : "text-[rgba(0,0,0,0.87)]"
              }`}
            >
              Catalog
            </Link>
            {topCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className={`transition-colors hover:text-[var(--brand-accent)] ${
                  pathname === `/categories/${cat.slug}`
                    ? "text-[var(--brand-green)] border-b-2 border-[var(--brand-green)] pb-0.5"
                    : "text-[rgba(0,0,0,0.87)]"
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </nav>

          {/* Search Autocomplete */}
          <div className="flex-1 max-w-sm hidden sm:block">
            <SearchAutocomplete />
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-3">
            {/* Account Trigger */}
            <div ref={userMenuRef} className="relative">
              {session?.user ? (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 text-xs font-semibold"
                    aria-label="User account menu"
                  >
                    <User className="size-4 text-[var(--brand-green)]" />
                    <span className="hidden md:inline-block max-w-[100px] truncate">
                      {session.user.name || "Account"}
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </Button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-[var(--border)] bg-white p-2 shadow-lg z-50 text-xs">
                      <div className="px-3 py-2 border-b border-[var(--border)]">
                        <p className="font-bold text-[rgba(0,0,0,0.87)] truncate">
                          {session.user.name || "User"}
                        </p>
                        <p className="text-[rgba(0,0,0,0.58)] truncate">{session.user.email}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          href="/account"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full items-center px-3 py-2 rounded-lg hover:bg-[var(--brand-ceramic)] text-[rgba(0,0,0,0.87)] font-medium transition-colors"
                        >
                          Account Dashboard
                        </Link>
                        <Link
                          href="/account/orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full items-center px-3 py-2 rounded-lg hover:bg-[var(--brand-ceramic)] text-[rgba(0,0,0,0.87)] font-medium transition-colors"
                        >
                          Order History
                        </Link>
                        <Link
                          href="/account/addresses"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full items-center px-3 py-2 rounded-lg hover:bg-[var(--brand-ceramic)] text-[rgba(0,0,0,0.87)] font-medium transition-colors"
                        >
                          Address Book
                        </Link>
                      </div>
                      <div className="border-t border-[var(--border)] pt-1" />
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          signOut();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-[var(--destructive)] transition-colors text-left font-medium cursor-pointer"
                      >
                        <LogOut className="size-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Button variant="darkOutline" size="sm" asChild>
                  <Link href="/login" className="flex items-center gap-1.5">
                    <User className="size-3.5" />
                    <span>Sign In</span>
                  </Link>
                </Button>
              )}
            </div>

            {/* Shopping Cart Trigger */}
            <Button
              variant="outline"
              size="iconSm"
              onClick={openCart}
              className="relative rounded-full border-[var(--border)] text-[rgba(0,0,0,0.87)] hover:text-[var(--brand-accent)] hover:border-[var(--brand-accent)]"
              aria-label="View shopping bag"
            >
              <ShoppingBag className="size-4" />
              {isMounted && itemCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[10px] font-bold text-white tabular-nums shadow-xs animate-in zoom-in-75">
                  {itemCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Search Input */}
        <div className="pb-3 pt-1 sm:hidden">
          <SearchAutocomplete />
        </div>
      </div>
    </header>
  );
}
