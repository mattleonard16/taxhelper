"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Summary } from "@/types";

type BalanceTotals = Summary["byTypeTotals"];

function parseAmount(value: string | undefined): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function calculateBalanceTotals(totals: BalanceTotals) {
  const income = parseAmount(totals.INCOME_TAX);
  const sales = parseAmount(totals.SALES_TAX);
  const other = parseAmount(totals.OTHER);
  const expenses = sales + other;
  const balance = income - expenses;

  return { income, expenses, balance };
}

export function BalanceCard({ totals }: { totals: BalanceTotals }) {
  const { income, expenses, balance } = calculateBalanceTotals(totals);
  const balanceColor = balance >= 0 ? "text-emerald-600" : "text-rose-500";

  return (
    <Card className="border-0 bg-card/50 shadow-lg backdrop-blur" data-testid="balance-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Balance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className={cn("text-3xl font-bold", balanceColor)}>
            {formatCurrency(balance)}
          </p>
          <p className="text-xs text-muted-foreground">
            Income minus expenses for the selected period
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Income</span>
            <span className="font-medium">{formatCurrency(income)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Expenses</span>
            <span className="font-medium">{formatCurrency(expenses)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
