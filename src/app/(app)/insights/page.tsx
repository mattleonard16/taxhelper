"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InsightCard } from "@/components/insights/insight-card";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Insight } from "@/lib/insights";
import { sortInsights } from "@/lib/insights/sort-insights";
import type { Transaction } from "@/types";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
] as const;

function InsightsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-0 bg-card/50 shadow-lg backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState("30");

  // Edit/Delete state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const refreshParam = showRefreshing ? "&refresh=1" : "";
      const insightsRes = await fetch(`/api/insights?range=${range}${refreshParam}`);
      if (!insightsRes.ok) {
        throw new Error("Failed to load insights");
      }

      const insightsData = await insightsRes.json();
      const nextInsights = sortInsights(insightsData.insights ?? []);
      setInsights(nextInsights);

      const supportingIds = Array.from(
        new Set(
          nextInsights.flatMap((insight) => insight.supportingTransactionIds || [])
        )
      );

      if (supportingIds.length === 0) {
        setTransactions([]);
        return;
      }

      const chunkSize = 200;
      const fetchedTransactions: Transaction[] = [];

      for (let i = 0; i < supportingIds.length; i += chunkSize) {
        const chunk = supportingIds.slice(i, i + chunkSize);
        const idsParam = encodeURIComponent(chunk.join(","));
        const response = await fetch(`/api/transactions?ids=${idsParam}`);
        if (!response.ok) {
          throw new Error("Failed to load transactions");
        }
        const data = await response.json();
        if (Array.isArray(data.transactions)) {
          fetchedTransactions.push(...data.transactions);
        }
      }

      setTransactions(fetchedTransactions);
    } catch (error) {
      console.error("Error fetching insights:", error);
      toast.error("Failed to load insights");
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
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
        fetchData();
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

  const handleInsightStateUpdate = async (
    insightId: string | undefined,
    updates: { pinned?: boolean; dismissed?: boolean }
  ) => {
    if (!insightId) {
      toast.error("Insight is not ready to update yet");
      return;
    }

    try {
      const response = await fetch(`/api/insights/${insightId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        toast.error("Failed to update insight");
        return;
      }

      const data = await response.json();
      setInsights((current) =>
        sortInsights(
          current.map((insight) =>
            insight.id === insightId ? data.insight : insight
          )
        )
      );
    } catch {
      toast.error("Failed to update insight");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
          <p className="mt-1 text-muted-foreground">
            Discover patterns and anomalies in your spending
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <InsightsSkeleton />
      ) : insights.length === 0 ? (
        <Card className="border-0 bg-card/50 shadow-lg backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 rounded-full bg-secondary p-4">
              <Lightbulb className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No insights yet</h3>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              Keep tracking your transactions. Insights will appear when patterns emerge
              in your spending data.
            </p>
            <Button
              className="mt-6"
              onClick={() => {
                setEditingTransaction(null);
                setFormOpen(true);
              }}
            >
              Add a transaction
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => {
            const idsKey = Array.from(new Set(insight.supportingTransactionIds)).sort().join(",");
            const insightKey = insight.id ?? `${insight.type}-${idsKey}`;

            return (
              <InsightCard
                key={insightKey}
                insight={insight}
                transactions={transactions}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteClick}
                onUpdateInsightState={handleInsightStateUpdate}
              />
            );
          })}
        </div>
      )}

      <TransactionForm
        open={formOpen}
        onOpenChange={handleFormClose}
        onSuccess={fetchData}
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
