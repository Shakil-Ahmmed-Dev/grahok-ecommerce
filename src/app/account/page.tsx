"use client";

import * as React from "react";
import Link from "next/link";
import { Package, MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrencyBDT } from "@/lib/utils";
import type { TCustomerPublicProfile } from "@/features/customers/types";

export default function AccountOverviewPage() {
  const [customer, setCustomer] = React.useState<TCustomerPublicProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");

  React.useEffect(() => {
    let isCancelled = false;

    async function loadProfile() {
      try {
        const res = await fetch("/api/v1/customers/me");
        if (res.ok) {
          const data = (await res.json()) as TCustomerPublicProfile;
          if (!isCancelled) {
            setCustomer(data);
            setFirstName(data.firstName || "");
            setLastName(data.lastName || "");
            setPhone(data.phone || "");
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

    loadProfile();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/v1/customers/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });

      if (res.ok) {
        const updated = (await res.json()) as TCustomerPublicProfile;
        setCustomer(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // Handled
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Total Orders
          </span>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-1">
            {customer?.totalOrders ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Purchases placed to date</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Total Spent
          </span>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums mt-1">
            {formatCurrencyBDT(customer?.totalSpent ?? 0)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Across all confirmed orders</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Account Status
          </span>
          <div className="text-2xl font-bold tracking-tight text-emerald-700 capitalize mt-1">
            {customer?.status ?? "Active"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Full self-service access</p>
        </div>
      </div>

      {/* Profile Details Form */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
          <div>
            <h2 className="text-base font-bold text-foreground">Personal Profile</h2>
            <p className="text-xs text-muted-foreground">
              Update your customer contact details and delivery phone number.
            </p>
          </div>
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
              Changes Saved!
            </span>
          )}
        </div>

        <form onSubmit={handleUpdateProfile} className="max-w-xl">
          <FieldGroup>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>First Name</FieldLabel>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Shakil"
                />
              </Field>
              <Field>
                <FieldLabel>Last Name</FieldLabel>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ahmmed"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Email Address</FieldLabel>
              <Input value={customer?.email ?? ""} disabled className="bg-muted/40" />
            </Field>

            <Field>
              <FieldLabel>Phone Number (E.164 with +880)</FieldLabel>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+8801700000000"
                className="tabular-nums"
              />
            </Field>

            <Button type="submit" disabled={updating} size="sm" className="w-fit mt-2">
              {updating ? <Spinner className="size-3.5 mr-1.5" /> : null}
              <span>Save Profile Changes</span>
            </Button>
          </FieldGroup>
        </form>
      </div>

      {/* Quick Nav Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/account/orders"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-5 hover:border-foreground/30 hover:shadow-2xs transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
              <Package className="size-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">Order History & Tracking</h3>
              <p className="text-xs text-muted-foreground">Review past orders and track parcels</p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>

        <Link
          href="/account/addresses"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-5 hover:border-foreground/30 hover:shadow-2xs transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
              <MapPin className="size-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">Saved Address Book</h3>
              <p className="text-xs text-muted-foreground">Manage doorstep delivery locations</p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
