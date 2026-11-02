import type { Metadata } from "next";
import { cache } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/cart-context";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartSheet } from "@/components/cart/cart-sheet";
import categoriesActions from "@/features/categories/actions";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "GRAHOK | Curated Modern Commerce",
    template: "%s | GRAHOK",
  },
  description:
    "Curated everyday goods, utilitarian apparel, artisanal living, and tech essentials with nationwide doorstep delivery.",
};

const getCachedCategories = cache(async () => {
  try {
    return await categoriesActions.getCategoriesTree();
  } catch {
    return [];
  }
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const categories = await getCachedCategories();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <CartProvider>
          <Header categories={categories} />
          <main className="flex-1 flex flex-col">{children}</main>
          <Footer />
          <CartSheet />
        </CartProvider>
      </body>
    </html>
  );
}
