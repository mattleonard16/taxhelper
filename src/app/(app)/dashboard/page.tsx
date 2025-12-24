"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { TaxTimeseriesChart } from "@/components/dashboard/tax-timeseries-chart";
import { TaxByTypeChart } from "@/components/dashboard/tax-by-type-chart";
import { TopMerchants } from "@/components/dashboard/top-merchants";
import { DailyTaxInsights } from "@/components/dashboard/daily-tax-insights";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { ReceiptOrchestrationStats } from "@/components/dashboard/receipt-orchestration-stats";
import { CategoryBreakdownChart, CategoryData } from "@/components/dashboard/category-breakdown-chart";
import { DeductibleSummary } from "@/components/dashboard/deductible-summary";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { TransactionList } from "@/components/transactions/transaction-list";
import { getDateRanges } from "@/lib/format";
import { toast } from "sonner";
import { Summary, Transaction } from "@/types";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [receiptStats, setReceiptStats] = useState<{
    receipts: { total: number; processed: number; pending: number; failed: number };
    tax: { totalPaid: string; totalSpent: string; transactionCount: number };
    deductions: { total: string; count: number };
    categories: CategoryData[];
    avgConfidence: number | null;
  } | null>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    n: () => {
      if (!formOpen) {
        setEditingTransaction(null);
        setFormOpen(true);
      }
    },
    Escape: () => {
      if (deleteDialogOpen) {
        setDeleteDialogOpen(false);
      } else if (formOpen) {
        setFormOpen(false);
        setEditingTransaction(null);
      }
    },
  });

  const fetchData = useCallback(async () => {
    try {
      await fetch("/api/recurring/generate", { method: "POST" }).catch(() => { });

      const { thisYear } = getDateRanges();
      const [summaryRes, transactionsRes] = await Promise.all([
        fetch(`/api/summary?from=${thisYear.from}&to=${thisYear.to}`),
        fetch(`/api/transactions?limit=5`),
      ]);

      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        setTransactions(data.transactions);
      }

      // Fetch receipt orchestration stats
      const receiptStatsRes = await fetch("/api/receipts/stats");
      if (receiptStatsRes.ok) {
        setReceiptStats(await receiptStatsRes.json());
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Track your tax awareness across all transactions
          </p>
        </div>

        {/* Desktop Action Button */}
        <Button
          size="lg"
          className="hidden bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 sm:flex"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="mr-2 h-5 w-5" />
          Add Transaction
        </Button>
      </div>

      {/* Mobile FAB */}
      <Button
        size="icon"
        className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/40 transition-all hover:scale-105 active:scale-95 sm:hidden"
        onClick={() => setFormOpen(true)}
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Add Transaction</span>
      </Button>

      {/* Onboarding Checklist */}
      <OnboardingChecklist
        onAddTransaction={() => {
          setEditingTransaction(null);
          setFormOpen(true);
        }}
        onRefreshData={fetchData}
      />

      {summary && (
        <>
          <SummaryCards
            totalTax={summary.totalTax}
            totalSpent={summary.totalSpent}
            taxShare={summary.taxShare}
            transactionCount={summary.transactionCount}
            todayTax={summary.todayTax}
            avgDailyTax={summary.avgDailyTax}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <TaxTimeseriesChart data={summary.timeseries} />
            <TaxByTypeChart data={summary.byType} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <DailyTaxInsights
              timeseries={summary.timeseries}
              todayTax={summary.todayTax}
              avgDailyTax={summary.avgDailyTax}
            />
            <TopMerchants merchants={summary.topMerchants} />
          </div>

          {receiptStats && (
            <>
              <ReceiptOrchestrationStats
                receipts={receiptStats.receipts}
                tax={receiptStats.tax}
              />
              
              <DeductibleSummary
                total={receiptStats.deductions.total}
                count={receiptStats.deductions.count}
                totalSpent={receiptStats.tax.totalSpent}
                avgConfidence={receiptStats.avgConfidence}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <CategoryBreakdownChart categories={receiptStats.categories} />
                <div /> {/* Placeholder for balance */}
              </div>
            </>
          )}
        </>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
          <Button variant="ghost" asChild>
            <a href="/transactions">View all →</a>
          </Button>
        </div>
        <TransactionList
          transactions={transactions}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
        />
      </div>

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
