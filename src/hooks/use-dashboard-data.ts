import { useCallback, useEffect, useState } from "react";
import { getDateRanges } from "@/lib/format";
import type { Summary, Transaction } from "@/types";
import type { CategoryData } from "@/components/dashboard/category-breakdown-chart";

export interface ReceiptStats {
  receipts: { total: number; processed: number; pending: number; failed: number };
  tax: { totalPaid: string; totalSpent: string; transactionCount: number };
  deductions: { total: string; count: number };
  categories: CategoryData[];
  avgConfidence: number | null;
}

export interface DashboardData {
  summary: Summary | null;
  transactions: Transaction[];
  receiptStats: ReceiptStats | null;
}

const DEFAULT_DASHBOARD_DATA: DashboardData = {
  summary: null,
  transactions: [],
  receiptStats: null,
};

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(DEFAULT_DASHBOARD_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true);
    setError(null);

    try {
      await fetch("/api/recurring/generate", { method: "POST" }).catch(() => {});

      const { thisYear } = getDateRanges();
      const [summaryRes, transactionsRes, receiptStatsRes] = await Promise.all([
        fetch(`/api/summary?from=${thisYear.from}&to=${thisYear.to}`),
        fetch(`/api/transactions?limit=5`),
        fetch("/api/receipts/stats"),
      ]);

      const summaryData = summaryRes.ok ? await summaryRes.json() : undefined;
      const transactionsData = transactionsRes.ok ? await transactionsRes.json() : undefined;
      const receiptStatsData = receiptStatsRes.ok ? await receiptStatsRes.json() : undefined;

      if (!summaryRes.ok || !transactionsRes.ok || !receiptStatsRes.ok) {
        setError("Failed to load dashboard data");
      }

      setData((prev) => ({
        summary: summaryData ?? prev.summary,
        transactions: transactionsData?.transactions ?? prev.transactions,
        receiptStats: receiptStatsData ?? prev.receiptStats,
      }));
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  const refresh = useCallback(() => fetchDashboardData(false), [fetchDashboardData]);

  return { data, loading, error, refresh };
}
