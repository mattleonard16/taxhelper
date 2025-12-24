"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { useCurrency } from "@/hooks/use-user-settings";
import { BadgeCheck, TrendingUp, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeductibleSummaryProps {
  total: string;
  count: number;
  totalSpent: string;
  avgConfidence: number | null;
}

export function DeductibleSummary({
  total,
  count,
  totalSpent,
  avgConfidence,
}: DeductibleSummaryProps) {
  const userCurrency = useCurrency();
  const deductibleAmount = parseFloat(total);
  const spentAmount = parseFloat(totalSpent);
  const percentage = spentAmount > 0 ? (deductibleAmount / spentAmount) * 100 : 0;
  const confidencePercent = avgConfidence !== null ? Math.round(avgConfidence * 100) : null;

  const stats = [
    {
      label: "Deductible Expenses",
      value: formatCurrency(deductibleAmount, userCurrency),
      subtitle: `${count} receipt${count !== 1 ? "s" : ""} flagged`,
      icon: BadgeCheck,
      gradient: "from-emerald-500/20 to-emerald-500/5",
      iconColor: "text-emerald-500",
    },
    {
      label: "Deductible Rate",
      value: `${percentage.toFixed(1)}%`,
      subtitle: "of total spending",
      icon: TrendingUp,
      gradient: "from-blue-500/20 to-blue-500/5",
      iconColor: "text-blue-500",
    },
  ];

  if (confidencePercent !== null) {
    stats.push({
      label: "Extraction Accuracy",
      value: `${confidencePercent}%`,
      subtitle: "average confidence",
      icon: Receipt,
      gradient: "from-violet-500/20 to-violet-500/5",
      iconColor: "text-violet-500",
    });
  }

  return (
    <Card className="border-0 bg-card/50 shadow-lg backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Deductible Tracking</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "relative overflow-hidden rounded-lg bg-gradient-to-br p-4",
                stat.gradient
              )}
            >
              <div className="absolute right-3 top-3">
                <stat.icon className={cn("h-6 w-6 opacity-50", stat.iconColor)} />
              </div>
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{stat.subtitle}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
