"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

interface MerchantData {
  merchant: string;
  tax: string;
}

interface TopMerchantsProps {
  merchants: MerchantData[];
}

export function TopMerchants({ merchants }: TopMerchantsProps) {
  const maxTax = merchants.length > 0 ? Math.max(...merchants.map((m) => parseFloat(m.tax))) : 0;

  return (
    <Card className="border-0 bg-card/50 shadow-lg backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Top Merchants by Tax</CardTitle>
      </CardHeader>
      <CardContent>
        {merchants.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No merchant data yet.
          </div>
        ) : (
          <div className="space-y-4">
            {merchants.map((merchant, index) => {
              const taxAmount = parseFloat(merchant.tax);
              const percentage = maxTax > 0 ? (taxAmount / maxTax) * 100 : 0;

              return (
                <div key={merchant.merchant} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="font-medium">{merchant.merchant}</span>
                    </div>
                    <span className="font-semibold text-chart-1">
                      {formatCurrency(taxAmount)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-chart-1 to-chart-2 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

