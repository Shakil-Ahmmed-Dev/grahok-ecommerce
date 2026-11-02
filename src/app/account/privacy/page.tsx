"use client";

import * as React from "react";
import { Download, Shield, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function AccountPrivacyPage() {
  const [downloading, setDownloading] = React.useState(false);
  const [downloadSuccess, setDownloadSuccess] = React.useState(false);

  const handleExportData = async () => {
    setDownloading(true);
    setDownloadSuccess(false);

    try {
      const res = await fetch("/api/v1/customers/me/export");
      if (!res.ok) {
        throw new Error("Unable to generate data export.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `grahok-customer-data-export.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch {
      alert("Failed to export data. Please try again later or contact customer support.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="pb-4 border-b border-border">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Privacy & Data Governance</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your personal data portability and review our privacy commitments.
        </p>
      </div>

      {/* Data Portability */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-2xs flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center shrink-0">
            <Download className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Data Portability (GDPR Export)</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Download a machine-readable JSON copy of your complete account information, including
              profile details, saved addresses, and security audit logs.
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <Button
            onClick={handleExportData}
            disabled={downloading}
            size="sm"
            variant="outline"
            className="text-xs"
          >
            {downloading ? <Spinner className="size-3.5 mr-1.5" /> : <Download className="size-3.5 mr-1.5" />}
            <span>Export Personal Data (.json)</span>
          </Button>

          {downloadSuccess && (
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="size-3.5" />
              <span>Export downloaded!</span>
            </span>
          )}
        </div>
      </div>

      {/* Account Deletion / Right to Erasure */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-2xs flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-orange-50 text-[var(--saffron)] flex items-center justify-center shrink-0">
            <Shield className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Account Deletion & Erasure</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              To protect customer order records, legal compliance, and ongoing delivery warranties,
              complete account anonymization and data erasure is managed securely by our data protection officer.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-4 border border-border text-xs text-muted-foreground flex flex-col gap-2">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Mail className="size-4 text-[var(--saffron)]" />
            <span>Support Request Procedure</span>
          </div>
          <p className="leading-relaxed">
            Please send an account deletion request from your registered email address to{" "}
            <strong className="text-foreground">support@grahok.com</strong> with the subject line{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground font-mono">
              Account Deletion Request
            </code>
            . Our compliance team verifies pending orders and processes requests within 48 business hours.
          </p>
        </div>
      </div>
    </div>
  );
}
