"use client";

import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { TransactionFilters } from "@/hooks/use-persisted-filters";

interface FilterChipsProps {
  filters: TransactionFilters;
  onRemove: <K extends keyof TransactionFilters>(key: K, defaultValue: TransactionFilters[K]) => void;
}

const TYPE_LABELS: Record<string, string> = {
  SALES_TAX: "Sales Tax",
  INCOME_TAX: "Income Tax",
  OTHER: "Other",
};

const CATEGORY_LABELS: Record<string, string> = {
  MEALS: "Meals & Entertainment",
  TRAVEL: "Travel",
  OFFICE: "Office Supplies",
  UTILITIES: "Utilities",
  SOFTWARE: "Software & Subscriptions",
  PROFESSIONAL: "Professional Services",
  OTHER: "Other",
};

export function FilterChips({ filters, onRemove }: FilterChipsProps) {
  const chips: Array<{ key: keyof TransactionFilters; label: string; defaultValue: string }> = [];

  if (filters.fromDate) {
    chips.push({ key: "fromDate", label: `From: ${filters.fromDate}`, defaultValue: "" });
  }
  if (filters.toDate) {
    chips.push({ key: "toDate", label: `To: ${filters.toDate}`, defaultValue: "" });
  }
  if (filters.typeFilter !== "all") {
    chips.push({ 
      key: "typeFilter", 
      label: `Type: ${TYPE_LABELS[filters.typeFilter] || filters.typeFilter}`,
      defaultValue: "all"
    });
  }
  if (filters.search) {
    chips.push({ key: "search", label: `Search: "${filters.search}"`, defaultValue: "" });
  }
  if (filters.minAmount) {
    chips.push({ key: "minAmount", label: `Min: $${filters.minAmount}`, defaultValue: "" });
  }
  if (filters.maxAmount) {
    chips.push({ key: "maxAmount", label: `Max: $${filters.maxAmount}`, defaultValue: "" });
  }
  if (filters.category !== "all") {
    chips.push({
      key: "category",
      label: `Category: ${CATEGORY_LABELS[filters.category] || filters.category}`,
      defaultValue: "all"
    });
  }
  if (filters.isDeductible !== "all") {
    chips.push({
      key: "isDeductible",
      label: filters.isDeductible === "true" ? "Deductible" : "Not Deductible",
      defaultValue: "all"
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="filter-chips">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="flex items-center gap-1 px-2 py-1 text-xs cursor-pointer hover:bg-destructive/20"
          onClick={() => onRemove(chip.key, chip.defaultValue as TransactionFilters[typeof chip.key])}
          data-testid={`filter-chip-${chip.key}`}
        >
          {chip.label}
          <X className="h-3 w-3" />
        </Badge>
      ))}
    </div>
  );
}
