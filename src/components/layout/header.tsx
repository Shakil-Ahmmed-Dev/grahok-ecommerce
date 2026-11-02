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

  // Top level categories to display in main nav
  const topCategories = categories.slice(0, 5);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      {/* Top utility ticker */}
      <div className="bg-primary text-primary-foreground px-4 py-1.5 text-center text-xs font-medium">
        <span>Fast Nationwide Doorstep Delivery &middot; 100% Encrypted & Secure Checkout</span>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Mobile hamburger menu */}
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-6">
                <SheetHeader className="text-left border-b pb-4">
                  <SheetTitle className="font-bold text-xl tracking-tight">
                    GRAHOK<span className="text-[var(--saffron)]">.</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-3 mt-6">
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-base font-medium hover:text-[var(--saffron)] transition-colors py-1"
                  >
                    Home
                  </Link>
                  <Link
                    href="/products"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-base font-medium hover:text-[var(--saffron)] transition-colors py-1"
                  >
                    All Products
                  </Link>

                  {topCategories.length > 0 && (
                    <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Categories
                      </span>
                      {topCategories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/categories/${cat.slug}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t flex flex-col gap-2">
                    {session?.user ? (
                      <>
                        <Link
                          href="/account"
                          onClick={() => setMobileMenuOpen(false)}
                          className="text-sm font-medium hover:text-[var(--saffron)] transition-colors py-1"
                        >
                          Account Dashboard
                        </Link>
                        <button
                          onClick={() => {
                            setMobileMenuOpen(false);
                            signOut();
                          }}
                          className="text-left text-sm font-medium text-destructive hover:underline py-1"
                        >
                          Sign Out
                        </button>
                      </>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-sm font-medium hover:text-[var(--saffron)] transition-colors py-1"
                      >
                        Sign In / Register
                      </Link>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-1 shrink-0 group">
            <span className="font-bold text-2xl tracking-tighter text-foreground group-hover:text-primary transition-colors">
              GRAHOK
            </span>
            <span className="size-2 rounded-full bg-[var(--saffron)] group-hover:scale-125 transition-transform" />
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
            <Link
              href="/products"
              className={`transition-colors hover:text-foreground ${
                pathname === "/products" ? "text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              Catalog
            </Link>
            {topCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className={`transition-colors hover:text-foreground ${
                  pathname === `/categories/${cat.slug}`
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </nav>

          {/* Search bar */}
          <div className="flex-1 max-w-sm hidden sm:block">
            <SearchAutocomplete />
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            {/* User Account Menu */}
            <div ref={userMenuRef} className="relative">
              {session?.user ? (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 text-xs font-medium"
                    aria-label="User account menu"
                  >
                    <User className="size-4" />
                    <span className="hidden md:inline-block max-w-[100px] truncate">
                      {session.user.name || "Account"}
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </Button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg z-50 text-xs">
                      <div className="px-3 py-2 border-b border-border">
                        <p className="font-medium text-foreground truncate">
                          {session.user.name || "User"}
                        </p>
                        <p className="text-muted-foreground truncate">{session.user.email}</p>
                      </div>
                      <Link
                        href="/account"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center px-3 py-2 rounded-md hover:bg-muted text-foreground transition-colors"
                      >
                        Account Dashboard
                      </Link>
                      <Link
                        href="/account/orders"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center px-3 py-2 rounded-md hover:bg-muted text-foreground transition-colors"
                      >
                        Order History
                      </Link>
                      <Link
                        href="/account/addresses"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center px-3 py-2 rounded-md hover:bg-muted text-foreground transition-colors"
                      >
                        Address Book
                      </Link>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          signOut();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 rounded-md hover:bg-destructive/10 text-destructive transition-colors text-left"
                      >
                        <LogOut className="size-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Button variant="ghost" size="sm" asChild className="text-xs">
                  <Link href="/login" className="flex items-center gap-1.5">
                    <User className="size-4" />
                    <span className="hidden sm:inline">Sign In</span>
                  </Link>
                </Button>
              )}
            </div>

            {/* Cart Trigger Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={openCart}
              className="relative size-9"
              aria-label="View shopping cart"
            >
              <ShoppingBag className="size-4 text-foreground" />
              {isMounted && itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-[var(--saffron)] text-[10px] font-bold text-white tabular-nums shadow-sm animate-in zoom-in-75">
                  {itemCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Search Input (Visible only on small viewports) */}
        <div className="pb-3 pt-1 sm:hidden">
          <SearchAutocomplete />
        </div>
      </div>
    </header>
  );
}
