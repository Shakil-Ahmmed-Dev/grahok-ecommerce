import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrderReceipt } from "@/components/orders/order-receipt";

interface OrderPageProps {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: "Order Details",
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: OrderPageProps) {
  const { orderId } = await params;
  const search = await searchParams;
  const token = typeof search.token === "string" ? search.token : undefined;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Orders</span>
        </Link>
      </div>

      <OrderReceipt orderId={orderId} initialToken={token} />
    </div>
  );
}
