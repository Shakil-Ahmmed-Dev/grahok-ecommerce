"use client";

import * as React from "react";
import Link from "next/link";
import { Package, Eye, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrencyBDT } from "@/lib/utils";
import type { TOrderDTO } from "@/features/checkout/types";

export default function AccountOrdersPage() {
  const [orders, setOrders] = React.useState<TOrderDTO[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isCancelled = false;

    async function loadOrders() {
      try {
        const res = await fetch("/api/v1/customers/me/orders");
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            setOrders(data.items || []);
          }
        }
      } catch {
        // Handled
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Empty
        icon={<Package className="size-8" />}
        title="No Orders Found"
        description="You have not placed any orders yet. Discover our curated catalog and place your first order."
        action={
          <Button asChild size="sm">
            <Link href="/products">Explore Products</Link>
          </Button>
        }
      />
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return <Badge variant="inStock">Delivered</Badge>;
      case "cancelled":
        return <Badge variant="outOfStock">Cancelled</Badge>;
      case "shipped":
        return <Badge variant="secondary">In Transit / Shipped</Badge>;
      case "processing":
      case "confirmed":
        return <Badge variant="backorder">Processing</Badge>;
      case "pending":
      default:
        return <Badge variant="outline">Order Placed</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="pb-4 border-b border-border">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Order History</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Review details, tracking timelines, and receipts for all your past purchases.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {orders.map((order) => {
          const dateStr = order.createdAt
            ? new Date(order.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Recent";

          return (
            <div
              key={order.id}
              className="rounded-xl border border-border bg-card p-5 shadow-2xs hover:border-foreground/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <span className="font-bold font-mono text-sm text-foreground tabular-nums">
                    {order.orderNumber}
                  </span>
                  {getStatusBadge(order.status)}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    <span>{dateStr}</span>
                  </span>
                  <span>&middot;</span>
                  <span className="tabular-nums">
                    {order.items?.length || 1} {order.items?.length === 1 ? "item" : "items"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                <div className="text-right">
                  <span className="text-[11px] text-muted-foreground block">Order Total</span>
                  <span className="text-base font-bold tabular-nums text-foreground">
                    {formatCurrencyBDT(order.totalAmount)}
                  </span>
                </div>

                <Button asChild variant="outline" size="sm" className="h-9 text-xs">
                  <Link href={`/orders/${order.id}`}>
                    <Eye className="size-3.5 mr-1.5" />
                    <span>View Receipt</span>
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
