"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { ReceiptJobStatus } from "@prisma/client";

export interface InboxJob {
  id: string;
  status: ReceiptJobStatus;
  originalName: string;
  mimeType: string;
  fileSize: number;
  merchant: string | null;
  date: string | null;
  totalAmount: string | null;
  taxAmount: string | null;
  category: string | null;
  categoryCode: string | null;
  isDeductible: boolean;
  extractionConfidence: number | null;
  transactionId: string | null;
  lastError: string | null;
  createdAt: string;
}

interface ReceiptReviewDrawerProps {
  job: InboxJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
  onRetried: () => void;
  onDeleted: () => void;
}

const STATUS_COLORS: Record<ReceiptJobStatus, string> = {
  QUEUED: "bg-gray-500",
  PROCESSING: "bg-blue-500",
  NEEDS_REVIEW: "bg-yellow-500",
  COMPLETED: "bg-green-500",
  CONFIRMED: "bg-emerald-600",
  FAILED: "bg-red-500",
};

function getConfidenceColor(confidence: number | null): string {
  if (confidence === null) return "text-gray-400";
  if (confidence >= 0.8) return "text-green-500";
  if (confidence >= 0.6) return "text-yellow-500";
  return "text-red-500";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReceiptReviewDrawer({
  job,
  open,
  onOpenChange,
  onConfirmed,
  onRetried,
  onDeleted,
}: ReceiptReviewDrawerProps) {
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [category, setCategory] = useState("");
  const [isDeductible, setIsDeductible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isEditable = job?.status === "NEEDS_REVIEW" || job?.status === "COMPLETED";
  const canConfirm = isEditable && merchant && date && totalAmount;
  const canRetry = job?.status === "FAILED";
  const isLocked = job?.status === "CONFIRMED";

  useEffect(() => {
    if (job) {
      setMerchant(job.merchant ?? "");
      setDate(job.date ? job.date.split("T")[0] : "");
      setTotalAmount(job.totalAmount ?? "");
      setTaxAmount(job.taxAmount ?? "");
      setCategory(job.category ?? "");
      setIsDeductible(job.isDeductible);
    }
  }, [job]);

  const handleSave = async (): Promise<boolean> => {
    if (!job || !isEditable) return false;
    setSaving(true);
    try {
      const response = await fetch(`/api/receipts/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant,
          date,
          totalAmount: totalAmount.trim() ? parseFloat(totalAmount) : undefined,
          taxAmount: taxAmount.trim() ? parseFloat(taxAmount) : 0,
          category,
          isDeductible,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }
      toast.success("Changes saved");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save changes");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!job || !canConfirm) return;
    setConfirming(true);
    try {
      // Save any pending changes first
      const saved = await handleSave();
      if (!saved) {
        return;
      }

      const response = await fetch(`/api/receipts/jobs/${job.id}/confirm`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to confirm");
      }
      toast.success("Transaction created!");
      onConfirmed();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to confirm");
    } finally {
      setConfirming(false);
    }
  };

  const handleRetry = async () => {
    if (!job || !canRetry) return;
    try {
      const response = await fetch(`/api/receipts/jobs/${job.id}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to retry");
      }
      toast.success("Job requeued for processing");
      onRetried();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry");
    }
  };

  const handleDelete = async () => {
    if (!job || isLocked) return;
    try {
      const response = await fetch(`/api/receipts/jobs/${job.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("Receipt discarded");
      onDeleted();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  if (!job) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Review Receipt
            <Badge className={STATUS_COLORS[job.status]}>{job.status.replace("_", " ")}</Badge>
          </SheetTitle>
          <SheetDescription>
            {job.originalName} ({formatFileSize(job.fileSize)})
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Confidence indicator */}
          {job.extractionConfidence !== null && (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-sm text-muted-foreground">Extraction Confidence</span>
              <span className={`font-medium ${getConfidenceColor(job.extractionConfidence)}`}>
                {Math.round(job.extractionConfidence * 100)}%
              </span>
            </div>
          )}

          {/* Error message for failed jobs */}
          {job.status === "FAILED" && job.lastError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">Error</p>
              <p className="mt-1 text-sm text-muted-foreground">{job.lastError}</p>
            </div>
          )}

          {/* Editable fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant *</Label>
              <Input
                id="merchant"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                disabled={!isEditable}
                placeholder="Store name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!isEditable}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalAmount">Total Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="totalAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    disabled={!isEditable}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxAmount">Tax Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="taxAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    disabled={!isEditable}
                    className="pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!isEditable}
                placeholder="e.g., Meals & Entertainment"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isDeductible">Tax Deductible</Label>
              <Switch
                id="isDeductible"
                checked={isDeductible}
                onCheckedChange={setIsDeductible}
                disabled={!isEditable}
              />
            </div>
          </div>

          {/* Linked transaction info */}
          {job.transactionId && (
            <div className="rounded-lg bg-emerald-500/10 p-3">
              <p className="text-sm font-medium text-emerald-600">Transaction Created</p>
              <p className="mt-1 text-xs text-muted-foreground">ID: {job.transactionId}</p>
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 flex-col gap-2 sm:flex-row">
          {isEditable && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canConfirm || confirming}
                className="bg-gradient-to-r from-primary to-accent"
              >
                {confirming ? "Creating..." : "Confirm & Create Transaction"}
              </Button>
            </>
          )}
          {canRetry && (
            <Button variant="outline" onClick={handleRetry}>
              Retry Processing
            </Button>
          )}
          {!isLocked && (
            <Button variant="destructive" onClick={handleDelete}>
              Discard
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
