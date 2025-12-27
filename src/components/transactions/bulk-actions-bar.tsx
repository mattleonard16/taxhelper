"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { X, Trash2, Tag, CheckCircle, XCircle, Download } from "lucide-react";

interface BulkActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

const CATEGORIES = [
  { code: "MEALS", label: "Meals & Entertainment" },
  { code: "TRAVEL", label: "Travel" },
  { code: "OFFICE", label: "Office Supplies" },
  { code: "UTILITIES", label: "Utilities" },
  { code: "SOFTWARE", label: "Software & Subscriptions" },
  { code: "PROFESSIONAL", label: "Professional Services" },
  { code: "OTHER", label: "Other" },
];

export function BulkActionsBar({
  selectedIds,
  onClearSelection,
  onActionComplete,
}: BulkActionsBarProps) {
  const [loading, setLoading] = useState(false);

  if (selectedIds.length === 0) return null;

  const handleSetCategory = async (categoryCode: string) => {
    const category = CATEGORIES.find((c) => c.code === categoryCode);
    if (!category) return;

    setLoading(true);
    try {
      const response = await fetch("/api/transactions/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          updates: { category: category.label, categoryCode: category.code },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update");
      }

      const data = await response.json();
      toast.success(`Updated ${data.updatedCount} transactions`);
      onActionComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleSetDeductible = async (isDeductible: boolean) => {
    setLoading(true);
    try {
      const response = await fetch("/api/transactions/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          updates: { isDeductible },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update");
      }

      const data = await response.json();
      toast.success(`Marked ${data.updatedCount} as ${isDeductible ? "deductible" : "not deductible"}`);
      onActionComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} transactions? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/transactions/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }

      const data = await response.json();
      toast.success(`Deleted ${data.deletedCount} transactions`);
      onActionComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        format: "csv",
        ids: selectedIds.join(","),
      });
      const response = await fetch(`/api/export?${params}`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-selected-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Exported selected transactions");
    } catch {
      toast.error("Failed to export");
    }
  };

  return (
    <div className="sticky top-16 z-40 -mx-4 bg-primary/95 px-4 py-3 text-primary-foreground shadow-lg backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" data-testid="bulk-actions-bar">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-medium" data-testid="bulk-selected-count">{selectedIds.length} selected</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-primary-foreground/20"
            onClick={onClearSelection}
            data-testid="bulk-clear-selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-primary-foreground/30" />

        <div className="flex flex-wrap items-center gap-2">
          <Select onValueChange={handleSetCategory} disabled={loading}>
            <SelectTrigger className="h-8 w-40 bg-primary-foreground/10 border-primary-foreground/20">
              <Tag className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Set category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.code} value={cat.code}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 hover:bg-primary-foreground/20"
            onClick={() => handleSetDeductible(true)}
            disabled={loading}
          >
            <CheckCircle className="mr-1.5 h-4 w-4" />
            Deductible
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 hover:bg-primary-foreground/20"
            onClick={() => handleSetDeductible(false)}
            disabled={loading}
          >
            <XCircle className="mr-1.5 h-4 w-4" />
            Not Deductible
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 hover:bg-primary-foreground/20"
            onClick={handleExport}
            disabled={loading}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-destructive-foreground hover:bg-destructive/80"
            onClick={handleDelete}
            disabled={loading}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
