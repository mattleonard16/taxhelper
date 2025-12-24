"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  Car,
  GraduationCap,
  Heart,
  HeartPulse,
  Home,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";
import type { DeductionCategory } from "@/lib/deductions";

type DeductionSummary = {
  category: DeductionCategory;
  potentialDeduction: number;
  estimatedSavings: number;
  transactions: string[];
  suggestion: string;
};

type DeductionsResponse = {
  deductions: DeductionSummary[];
  totalPotentialDeduction: number;
  estimatedTaxSavings: number;
  taxRateUsed?: number;
};

const CATEGORY_CONFIG: Record<
  DeductionCategory,
  { label: string; icon: typeof Heart; color: string; accent: string }
> = {
  HOME_OFFICE: {
    label: "Home Office",
    icon: Home,
    color: "bg-sky-500/15 text-sky-600 border-sky-500/30",
    accent: "text-sky-600",
  },
  BUSINESS_TRAVEL: {
    label: "Business Travel",
    icon: Car,
    color: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    accent: "text-amber-600",
  },
  OFFICE_SUPPLIES: {
    label: "Office Supplies",
    icon: Package,
    color: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
    accent: "text-indigo-600",
  },
  PROFESSIONAL_DEVELOPMENT: {
    label: "Professional Development",
    icon: GraduationCap,
    color: "bg-violet-500/15 text-violet-600 border-violet-500/30",
    accent: "text-violet-600",
  },
  HEALTH: {
    label: "Health",
    icon: HeartPulse,
    color: "bg-rose-500/15 text-rose-600 border-rose-500/30",
    accent: "text-rose-600",
  },
  CHARITY: {
    label: "Charity",
    icon: Heart,
    color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    accent: "text-emerald-600",
  },
};

function DeductionsSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-lg">
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-6 h-4 w-64" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border bg-card/50 shadow-lg backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="mt-4 h-6 w-40" />
              <Skeleton className="mt-2 h-4 w-28" />
              <Skeleton className="mt-4 h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DeductionsPage() {
  const [summary, setSummary] = useState<DeductionsResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const fetchDeductions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/insights/deductions?range=365");
      if (!response.ok) {
        throw new Error("Failed to load deductions");
      }

      const data = (await response.json()) as DeductionsResponse;
      setSummary(data);

      const ids = Array.from(
        new Set(data.deductions.flatMap((deduction) => deduction.transactions))
      ).filter(Boolean);

      if (ids.length === 0) {
        setTransactions([]);
        return;
      }

      setLoadingTransactions(true);
      const fetched: Transaction[] = [];
      const chunkSize = 200;

      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const idsParam = encodeURIComponent(chunk.join(","));
        const transactionResponse = await fetch(`/api/transactions?ids=${idsParam}`);
        if (!transactionResponse.ok) {
          throw new Error("Failed to load transactions");
        }
        const transactionData = await transactionResponse.json();
        if (Array.isArray(transactionData.transactions)) {
          fetched.push(...transactionData.transactions);
        }
      }

      setTransactions(fetched);
    } catch (error) {
      console.error("Error fetching deductions:", error);
      toast.error("Failed to load deductions");
      setSummary(null);
      setTransactions([]);
    } finally {
      setLoading(false);
      setLoadingTransactions(false);
    }
  }, []);

  useEffect(() => {
    fetchDeductions();
  }, [fetchDeductions]);

  const transactionMap = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const transaction of transactions) {
      map.set(transaction.id, transaction);
    }
    return map;
  }, [transactions]);

  const toggleExpanded = (category: DeductionCategory) => {
    setExpanded((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  if (loading) {
    return <DeductionsSkeleton />;
  }

  if (!summary || summary.deductions.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deductions</h1>
          <p className="mt-1 text-muted-foreground">
            Discover potential tax deductions based on your transactions
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <BadgeDollarSign className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No deductions found.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add transactions to see potential savings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deductions</h1>
          <p className="mt-1 text-muted-foreground">
            Smart deduction discoveries based on your transactions
          </p>
        </div>
      </div>

      <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-lg">
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-emerald-600">
                Total Potential Deductions
              </p>
              <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-200">
                {formatCurrency(summary.totalPotentialDeduction)}
              </p>
              <p className="text-xs text-muted-foreground">
                Based on {typeof summary.taxRateUsed === "number" ? `${(summary.taxRateUsed * 100).toFixed(1)}%` : "25%"} marginal tax rate
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-emerald-600">
                Estimated Tax Savings
              </p>
              <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-200">
                {formatCurrency(summary.estimatedTaxSavings)}
              </p>
              <p className="text-xs text-muted-foreground">
                Potential savings this year
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summary.deductions.map((deduction) => {
          const config = CATEGORY_CONFIG[deduction.category];
          const Icon = config?.icon ?? BadgeDollarSign;
          const isExpanded = expanded[deduction.category] ?? false;
          const categoryTransactions = deduction.transactions
            .map((id) => transactionMap.get(id))
            .filter(Boolean) as Transaction[];
          const transactionCount = deduction.transactions.length;

          return (
            <Card
              key={deduction.category}
              className="border-border bg-card/50 shadow-lg backdrop-blur"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("rounded-lg border p-2", config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{config.label}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {transactionCount} transaction{transactionCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("border", config.color)}>
                    {formatCurrency(deduction.potentialDeduction)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estimated savings</span>
                  <span className={cn("font-semibold", config.accent)}>
                    {formatCurrency(deduction.estimatedSavings)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{deduction.suggestion}</p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleExpanded(deduction.category)}
                  >
                    {isExpanded ? (
                      <>
                        Hide transactions <ChevronUp className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        View {transactionCount} transaction
                        {transactionCount !== 1 ? "s" : ""}{" "}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      href={`/transactions?ids=${deduction.transactions.join(",")}`}
                    >
                      View Transactions →
                    </Link>
                  </Button>
                </div>

                {isExpanded && (
                  <div className="space-y-2">
                    {loadingTransactions && categoryTransactions.length === 0 && (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    )}

                    {categoryTransactions.length > 0 ? (
                      categoryTransactions.map((transaction) => (
                        <Link
                          key={transaction.id}
                          href={`/transactions?ids=${transaction.id}`}
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm transition hover:border-emerald-500/40 hover:bg-emerald-500/5"
                        >
                          <div>
                            <p className="font-medium">
                              {transaction.merchant || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {transaction.description || "No description"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatCurrency(
                                transaction.totalAmount,
                                transaction.currency
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatShortDate(transaction.date)}
                            </p>
                          </div>
                        </Link>
                      ))
                    ) : !loadingTransactions ? (
                      <p className="text-sm text-muted-foreground">
                        No transactions loaded.
                      </p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
