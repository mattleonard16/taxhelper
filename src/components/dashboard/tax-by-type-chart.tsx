"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

interface ByTypeData {
  SALES_TAX: string;
  INCOME_TAX: string;
  OTHER: string;
}

interface TaxByTypeChartProps {
  data: ByTypeData;
}

const COLORS = [
  "oklch(0.65 0.22 150)", // Green - Sales Tax
  "oklch(0.6 0.2 270)",   // Purple - Income Tax
  "oklch(0.7 0.18 45)",   // Orange - Other
];

const LABELS: Record<string, string> = {
  SALES_TAX: "Sales Tax",
  INCOME_TAX: "Income Tax",
  OTHER: "Other",
};

export function TaxByTypeChart({ data }: TaxByTypeChartProps) {
  const chartData = Object.entries(data)
    .map(([name, value]) => ({
      name: LABELS[name] || name,
      value: parseFloat(value),
      key: name,
    }))
    .filter((d) => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="border-0 bg-card/50 shadow-lg backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Tax by Type</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No tax data yet.
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
                          <p className="text-xs text-muted-foreground">{data.name}</p>
                          <p className="text-sm font-semibold">
                            {formatCurrency(data.value)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {((data.value / total) * 100).toFixed(1)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-row gap-6 lg:flex-col lg:gap-3">
              {chartData.map((item, index) => (
                <div key={item.key} className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.value)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

