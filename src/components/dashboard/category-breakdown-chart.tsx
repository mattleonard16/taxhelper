"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { useCurrency } from "@/hooks/use-user-settings";
import { getCategoryColor, DEFAULT_CATEGORY_COLOR } from "@/lib/categories";

export interface CategoryData {
  category: string;
  categoryCode: string;
  amount: number;
  count: number;
}

interface CategoryBreakdownChartProps {
  categories: CategoryData[];
}

const DEFAULT_COLOR = DEFAULT_CATEGORY_COLOR;

export function formatCategoryPercent(value: number, total: number): string {
  if (!Number.isFinite(total) || total <= 0) {
    return "0.0%";
  }
  const percent = (value / total) * 100;
  if (!Number.isFinite(percent)) {
    return "0.0%";
  }
  return `${percent.toFixed(1)}%`;
}

export function CategoryBreakdownChart({ categories }: CategoryBreakdownChartProps) {
  const userCurrency = useCurrency();

  const chartData = categories.map((cat) => ({
    name: cat.category,
    value: cat.amount,
    code: cat.categoryCode,
    count: cat.count,
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="border-0 bg-card/50 shadow-lg backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Expenses by Category</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No categorized receipts yet.
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
                  {chartData.map((item) => (
                    <Cell 
                      key={`cell-${item.code}`} 
                      fill={getCategoryColor(item.code)} 
                    />
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
                            {formatCurrency(data.value, userCurrency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {data.count} receipt{data.count !== 1 ? "s" : ""} ({formatCategoryPercent(data.value, total)})
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-4 lg:flex-col lg:gap-3">
              {chartData.slice(0, 6).map((item) => (
                <div key={item.code} className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: getCategoryColor(item.code) }}
                  />
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.value, userCurrency)}
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
