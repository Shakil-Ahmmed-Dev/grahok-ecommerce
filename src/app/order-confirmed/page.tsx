import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderReceipt } from "@/components/orders/order-receipt";

interface OrderConfirmedPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: "Order Confirmation",
};

export default async function OrderConfirmedPage({
  searchParams,
}: OrderConfirmedPageProps) {
  const search = await searchParams;
  const orderId = typeof search.orderId === "string" ? search.orderId : undefined;
  const token = typeof search.token === "string" ? search.token : undefined;

  if (!orderId) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">No Order Specified</h1>
        <p className="text-xs text-muted-foreground mt-2">
          Please check your order confirmation link or visit your account dashboard.
        </p>
        <Button asChild className="mt-6" size="sm">
          <Link href="/products">Browse Catalog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Continue Shopping</span>
        </Link>
      </div>

      <OrderReceipt orderId={orderId} initialToken={token} />
    </div>
  );
}
