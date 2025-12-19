"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatShortDate } from "@/lib/format";

interface TimeseriesData {
  date: string;
  tax: string;
}

interface TaxTimeseriesChartProps {
  data: TimeseriesData[];
}

export function TaxTimeseriesChart({ data }: TaxTimeseriesChartProps) {
  const chartData = data.map((d) => ({
    date: d.date,
    tax: parseFloat(d.tax),
    formattedDate: formatShortDate(d.date),
  }));

  return (
    <Card className="border-0 bg-card/50 shadow-lg backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Tax Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No data yet. Add some transactions to see your tax trends.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="taxGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.22 150)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="oklch(0.65 0.22 150)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="formattedDate"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.6 0.02 280)", fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.6 0.02 280)", fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
                dx={-10}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
                        <p className="text-xs text-muted-foreground">
                          {payload[0].payload.formattedDate}
                        </p>
                        <p className="text-sm font-semibold">
                          {formatCurrency(payload[0].value as number)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="tax"
                stroke="oklch(0.65 0.22 150)"
                strokeWidth={2}
                fill="url(#taxGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

