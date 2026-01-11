"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { TransactionList } from "@/components/transactions/transaction-list";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Transaction, Pagination } from "@/types";
import { TransactionListSkeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { getDateRanges } from "@/lib/format";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { usePersistedFilters } from "@/hooks/use-persisted-filters";
import { FilterChips } from "@/components/transactions/filter-chips";
import { BulkActionsBar } from "@/components/transactions/bulk-actions-bar";
import { UI_CATEGORY_OPTIONS } from "@/lib/categories";

function parseIds(value: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Persisted filters
  const { filters, updateFilter, clearFilters, hasActiveFilters, loaded } = usePersistedFilters();
  const [page, setPage] = useState(1);
  const searchParams = useSearchParams();
  const idsParam = searchParams?.get("ids") || "";
  const [idsFilter, setIdsFilter] = useState<string[]>(() => parseIds(idsParam));
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!idsParam) {
      setIdsFilter([]);
      return;
    }

    const ids = parseIds(idsParam);

    setIdsFilter(ids);
    setPage(1);
  }, [idsParam]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    n: () => {
      if (!formOpen) {
        setEditingTransaction(null);
        setFormOpen(true);
      }
    },
    "/": () => {
      searchInputRef.current?.focus();
    },
    Escape: () => {
      if (deleteDialogOpen) {
        setDeleteDialogOpen(false);
      } else if (formOpen) {
        setFormOpen(false);
        setEditingTransaction(null);
      } else if (document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    },
  });

  // Debounce search and amount filters to reduce API calls
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const debouncedMinAmount = useDebouncedValue(filters.minAmount, 300);
  const debouncedMaxAmount = useDebouncedValue(filters.maxAmount, 300);

  const fetchTransactions = useCallback(async () => {
    if (!loaded) return; // Wait for filters to load from localStorage
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (filters.fromDate) params.set("from", filters.fromDate);
      if (filters.toDate) params.set("to", filters.toDate);
      if (filters.typeFilter !== "all") params.set("type", filters.typeFilter);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (debouncedMinAmount) params.set("minAmount", debouncedMinAmount);
      if (debouncedMaxAmount) params.set("maxAmount", debouncedMaxAmount);
      if (filters.category !== "all") params.set("category", filters.category);
      if (filters.isDeductible !== "all") params.set("isDeductible", filters.isDeductible);
      if (idsFilter.length > 0) params.set("ids", idsFilter.join(","));

      const response = await fetch(`/api/transactions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [page, filters.fromDate, filters.toDate, filters.typeFilter, filters.category, filters.isDeductible, debouncedSearch, debouncedMinAmount, debouncedMaxAmount, idsFilter, loaded]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      const response = await fetch(`/api/transactions/${deletingId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Transaction deleted");
        fetchTransactions();
      } else {
        toast.error("Failed to delete transaction");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingTransaction(null);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkActionComplete = () => {
    setSelectedIds(new Set());
    fetchTransactions();
  };

  const handleClearFilters = () => {
    clearFilters();
    setPage(1);
    setIdsFilter([]);
  };

  const handleRemoveFilter = <K extends keyof typeof filters>(key: K, defaultValue: typeof filters[K]) => {
    updateFilter(key, defaultValue);
    setPage(1);
  };

  const showClearButton = hasActiveFilters || idsFilter.length > 0;

  const handleExport = async (format: "csv" | "json") => {
    try {
      const params = new URLSearchParams({ format });
      if (filters.fromDate) params.set("from", filters.fromDate);
      if (filters.toDate) params.set("to", filters.toDate);
      if (filters.typeFilter !== "all") params.set("type", filters.typeFilter);

      const response = await fetch(`/api/export?${params}`);
      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Failed to export transactions");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="mt-1 text-muted-foreground">
            View and manage all your tracked transactions
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg">
                <svg
                  className="mr-2 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="lg" asChild>
            <Link href="/reports">
              <svg
                className="mr-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Generate Report
            </Link>
          </Button>
          <Button
            size="lg"
            className="bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25"
            onClick={() => setFormOpen(true)}
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 rounded-xl border border-border bg-card/50 p-4 shadow-lg backdrop-blur">
        {/* Search bar */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search by merchant or description... (press / to focus)"
            value={filters.search}
            onChange={(e) => {
              updateFilter("search", e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>

        {/* Filter chips */}
        <FilterChips filters={filters} onRemove={handleRemoveFilter} />

        {/* Date range presets */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-muted-foreground self-center mr-2">Quick:</span>
          {Object.entries(getDateRanges()).map(([key, range]) => (
            <Button
              key={key}
              variant={filters.fromDate === range.from && filters.toDate === range.to ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                updateFilter("fromDate", range.from);
                updateFilter("toDate", range.to);
                setPage(1);
              }}
            >
              {range.label}
            </Button>
          ))}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">From</label>
            <Input
              type="date"
              value={filters.fromDate}
              onChange={(e) => {
                updateFilter("fromDate", e.target.value);
                setPage(1);
              }}
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">To</label>
            <Input
              type="date"
              value={filters.toDate}
              onChange={(e) => {
                updateFilter("toDate", e.target.value);
                setPage(1);
              }}
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Type</label>
            <Select
              value={filters.typeFilter}
              onValueChange={(value) => {
                updateFilter("typeFilter", value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40" aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="SALES_TAX">Sales Tax</SelectItem>
                <SelectItem value="INCOME_TAX">Income Tax</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Min Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={filters.minAmount}
                onChange={(e) => {
                  updateFilter("minAmount", e.target.value);
                  setPage(1);
                }}
                className="w-28 pl-7"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Max Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={filters.maxAmount}
                onChange={(e) => {
                  updateFilter("maxAmount", e.target.value);
                  setPage(1);
                }}
                className="w-28 pl-7"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Category</label>
            <Select
              value={filters.category}
              onValueChange={(value) => {
                updateFilter("category", value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {UI_CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat.code} value={cat.code}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Deductible</label>
            <Select
              value={filters.isDeductible}
              onValueChange={(value) => {
                updateFilter("isDeductible", value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showClearButton && (
            <Button variant="ghost" onClick={handleClearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        onClearSelection={handleClearSelection}
        onActionComplete={handleBulkActionComplete}
      />

      {loading ? (
        <TransactionListSkeleton rows={10} />
      ) : (
        <>
          <TransactionList
            transactions={transactions}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
          />

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="px-4 text-sm text-muted-foreground">
                Page {page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                disabled={page === pagination.pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <TransactionForm
        open={formOpen}
        onOpenChange={handleFormClose}
        onSuccess={fetchTransactions}
        transaction={editingTransaction}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete transaction?"
        description="This action cannot be undone. This will permanently delete the transaction."
      />
    </div>
  );
}
