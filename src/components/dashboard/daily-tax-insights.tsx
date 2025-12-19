"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DailyTaxInsightsProps {
  timeseries: { date: string; tax: string }[];
  todayTax: string;
  avgDailyTax: string;
}

export function DailyTaxInsights({
  timeseries,
  todayTax,
  avgDailyTax,
}: DailyTaxInsightsProps) {
  // Get today and yesterday's tax
  const today = new Date().toISOString().split("T")[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split("T")[0];

  const yesterdayData = timeseries.find((d) => d.date === yesterday);

  const todayAmount = parseFloat(todayTax);
  const yesterdayAmount = yesterdayData ? parseFloat(yesterdayData.tax) : 0;
  const avgAmount = parseFloat(avgDailyTax);

  // Calculate change from yesterday
  const changeFromYesterday =
    yesterdayAmount > 0
      ? ((todayAmount - yesterdayAmount) / yesterdayAmount) * 100
      : todayAmount > 0
        ? 100
        : 0;

  // Compare to average
  const vsAverage =
    avgAmount > 0 ? ((todayAmount - avgAmount) / avgAmount) * 100 : 0;

  // Get last 7 days for mini chart
  const last7Days = timeseries.slice(-7);
  const maxTax = Math.max(...last7Days.map((d) => parseFloat(d.tax)), 1);

  return (
    <Card className="border-0 bg-card/50 shadow-lg backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Daily Tax Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Today vs Yesterday */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Today&apos;s Tax</p>
            <p className="text-2xl font-bold">{formatCurrency(todayAmount)}</p>
            {yesterdayAmount > 0 && (
              <p
                className={cn(
                  "text-xs font-medium",
                  changeFromYesterday >= 0 ? "text-rose-500" : "text-emerald-500"
                )}
              >
                {changeFromYesterday >= 0 ? "↑" : "↓"} {Math.abs(changeFromYesterday).toFixed(1)}% vs yesterday
              </p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Yesterday&apos;s Tax</p>
            <p className="text-2xl font-bold">{formatCurrency(yesterdayAmount)}</p>
            <p className="text-xs text-muted-foreground">
              {yesterdayData ? formatShortDate(yesterday) : "No data"}
            </p>
          </div>
        </div>

        {/* Comparison to Average */}
        <div className="rounded-lg bg-secondary/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">vs Daily Average</p>
              <p className="text-xs text-muted-foreground">Avg: {formatCurrency(avgAmount)}/day</p>
            </div>
            <div
              className={cn(
                "text-lg font-bold",
                vsAverage > 10
                  ? "text-rose-500"
                  : vsAverage < -10
                    ? "text-emerald-500"
                    : "text-amber-500"
              )}
            >
              {vsAverage >= 0 ? "+" : ""}
              {vsAverage.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Mini 7-day bar chart */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Last 7 Days</p>
          <div className="flex h-16 items-end gap-1">
            {last7Days.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent data</p>
            ) : (
              last7Days.map((day) => {
                const height = (parseFloat(day.tax) / maxTax) * 100;
                const isToday = day.date === today;
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={cn(
                        "w-full rounded-t transition-all",
                        isToday ? "bg-primary" : "bg-primary/40"
                      )}
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${formatShortDate(day.date)}: ${formatCurrency(day.tax)}`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(day.date).toLocaleDateString("en-US", { weekday: "narrow" })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
