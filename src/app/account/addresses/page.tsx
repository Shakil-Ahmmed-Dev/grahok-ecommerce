"use client";

import * as React from "react";
import { Plus, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Empty } from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TCustomerAddressDTO } from "@/features/customers/types";

export default function AccountAddressesPage() {
  const [addresses, setAddresses] = React.useState<TCustomerAddressDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // New Address Form State
  const [recipientName, setRecipientName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [addressLine1, setAddressLine1] = React.useState("");
  const [addressLine2, setAddressLine2] = React.useState("");
  const [city, setCity] = React.useState("Dhaka");
  const [postalCode, setPostalCode] = React.useState("");
  const [isDefaultShipping, setIsDefaultShipping] = React.useState(false);
  const [isDefaultBilling, setIsDefaultBilling] = React.useState(false);

  const refreshAddresses = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/customers/me/addresses");
      if (res.ok) {
        const data = (await res.json()) as TCustomerAddressDTO[];
        setAddresses(data || []);
      }
    } catch {
      // Handled
    }
  }, []);

  React.useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/v1/customers/me/addresses");
        if (res.ok) {
          const data = (await res.json()) as TCustomerAddressDTO[];
          if (!isCancelled) {
            setAddresses(data || []);
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

    load();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // E.164 phone formatting
    let cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, "");
    if (!cleanPhone.startsWith("+")) {
      cleanPhone = `+880${cleanPhone.replace(/^0+/, "")}`;
    }

    if (!recipientName.trim() || !addressLine1.trim() || !city.trim() || !postalCode.trim()) {
      setFormError("Please fill in all required fields.");
      return;
    }

    if (!/^\+[1-9]\d{6,14}$/.test(cleanPhone)) {
      setFormError("Please provide a valid phone number (e.g. 1712345678 or +8801712345678).");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/v1/customers/me/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          phone: cleanPhone,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          postalCode: postalCode.trim(),
          countryCode: "BD",
          addressType: "both",
          isDefaultShipping,
          isDefaultBilling,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to save address.");
      }

      // Reset and refresh
      setRecipientName("");
      setPhone("");
      setAddressLine1("");
      setAddressLine2("");
      setPostalCode("");
      setIsDefaultShipping(false);
      setIsDefaultBilling(false);
      setModalOpen(false);
      refreshAddresses();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error saving address.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      const res = await fetch(`/api/v1/customers/me/addresses/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // Handled
    }
  };

  const handleSetDefault = async (id: string, type: "shipping" | "billing") => {
    try {
      const res = await fetch(`/api/v1/customers/me/addresses/${id}/default`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        refreshAddresses();
      }
    } catch {
      // Handled
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between pb-4 border-b border-[var(--brand-green)]/10">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--brand-green)]">Address Book</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your saved delivery locations for fast 1-click checkout.
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} size="sm" className="h-9 text-xs">
          <Plus className="size-3.5 mr-1.5" />
          <span>Add New Address</span>
        </Button>
      </div>

      {addresses.length === 0 ? (
        <Empty
          icon={<MapPin className="size-8" />}
          title="No Addresses Saved"
          description="Save your home, office, or gift delivery addresses for rapid checkout."
          action={
            <Button onClick={() => setModalOpen(true)} size="sm">
              <Plus className="size-3.5 mr-1.5" />
              <span>Add Your First Address</span>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="rounded-xl border border-[var(--brand-green)]/10 bg-white p-5 shadow-starbucks-card flex flex-col justify-between gap-4"
            >
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-[var(--brand-green)]">{addr.recipientName}</h3>
                  <div className="flex items-center gap-1.5">
                    {addr.isDefaultShipping && (
                      <Badge variant="inStock" className="text-[10px] py-0 px-2">
                        Default Shipping
                      </Badge>
                    )}
                    {addr.isDefaultBilling && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-2">
                        Default Billing
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="text-muted-foreground leading-relaxed">
                  {addr.addressLine1}
                  {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {addr.city}, {addr.postalCode} &middot; Bangladesh
                </p>
                <p className="text-muted-foreground font-mono tabular-nums mt-1">{addr.phone}</p>
              </div>

              <div className="pt-3 border-t border-[var(--brand-green)]/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {!addr.isDefaultShipping && (
                    <button
                      onClick={() => handleSetDefault(addr.id, "shipping")}
                      className="text-muted-foreground hover:text-[var(--brand-green)] underline transition-colors"
                    >
                      Make Default Shipping
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteAddress(addr.id)}
                  aria-label="Delete address"
                  className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Address Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Delivery Address</DialogTitle>
            <DialogDescription>
              Enter the recipient details and delivery street address.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateAddress} className="flex flex-col gap-4 py-2">
            <FieldGroup>
              <Field>
                <FieldLabel required>Recipient Full Name</FieldLabel>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </Field>

              <Field>
                <FieldLabel required>Phone Number (SMS & Courier Verification)</FieldLabel>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="1712345678 or +8801712345678"
                  required
                />
              </Field>

              <Field>
                <FieldLabel required>Street Address</FieldLabel>
                <Input
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="House 12, Road 4, Sector 3"
                  required
                />
              </Field>

              <Field>
                <FieldLabel>Apartment / Suite (optional)</FieldLabel>
                <Input
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Apt 4B"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel required>City / District</FieldLabel>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Dhaka"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel required>Postal Code</FieldLabel>
                  <Input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="1230"
                    required
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-2 pt-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDefaultShipping}
                    onChange={(e) => setIsDefaultShipping(e.target.checked)}
                    className="size-4 rounded border-border text-primary"
                  />
                  <span>Set as default shipping address</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDefaultBilling}
                    onChange={(e) => setIsDefaultBilling(e.target.checked)}
                    className="size-4 rounded border-border text-primary"
                  />
                  <span>Set as default billing address</span>
                </label>
              </div>
            </FieldGroup>

            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? <Spinner className="size-3.5 mr-1" /> : null}
                <span>Save Address</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
