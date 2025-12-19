"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useCurrency } from "@/hooks/use-user-settings";
import { cn } from "@/lib/utils";
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";

interface SummaryCardsProps {
  totalTax: string;
  totalSpent: string;
  taxShare: number;
  transactionCount: number;
  todayTax: string;
  avgDailyTax: string;
}

function AnimatedValue({
  value,
  format,
  durationMs = 800,
}: {
  value: number;
  format: (value: number) => string;
  durationMs?: number;
}) {
  const reducedMotion = useReducedMotion();
  const initialValue = reducedMotion ? value : 0;
  const motionValue = useMotionValue(initialValue);
  const [display, setDisplay] = useState(() => format(initialValue));

  useMotionValueEvent(motionValue, "change", (latest) => {
    setDisplay(format(latest));
  });

  useEffect(() => {
    if (reducedMotion) {
      motionValue.set(value);
      return;
    }

    const controls = animate(motionValue, value, {
      duration: durationMs / 1000,
      ease: "easeOut",
    });

    return () => controls.stop();
  }, [durationMs, format, motionValue, reducedMotion, value]);

  return <span>{display}</span>;
}

export const SummaryCards = React.memo(function SummaryCards({
  totalTax,
  totalSpent,
  taxShare,
  transactionCount,
  todayTax,
  avgDailyTax,
}: SummaryCardsProps) {
  const reducedMotion = useReducedMotion();
  const userCurrency = useCurrency();
  const cards = useMemo(() => {
    const currency = (v: number) => formatCurrency(v, userCurrency);
    const integer = (v: number) => Math.round(v).toString();

    return [
      {
        title: "Tax Today",
        value: parseFloat(todayTax) || 0,
        format: currency,
        subtitle: "Paid so far today",
        gradient: "from-rose-500/20 to-rose-500/5",
        iconBg: "bg-rose-500",
      },
      {
        title: "Daily Average",
        value: parseFloat(avgDailyTax) || 0,
        format: currency,
        subtitle: "Per day tracked",
        gradient: "from-amber-500/20 to-amber-500/5",
        iconBg: "bg-amber-500",
      },
      {
        title: "Total Tax Paid",
        value: parseFloat(totalTax) || 0,
        format: currency,
        subtitle: "This year",
        gradient: "from-chart-1/20 to-chart-1/5",
        iconBg: "bg-chart-1",
      },
      {
        title: "Total Spending",
        value: parseFloat(totalSpent) || 0,
        format: currency,
        subtitle: "Tracked amount",
        gradient: "from-chart-2/20 to-chart-2/5",
        iconBg: "bg-chart-2",
      },
      {
        title: "Tax Rate",
        value: taxShare || 0,
        format: formatPercent,
        subtitle: "Of total spending",
        gradient: "from-chart-3/20 to-chart-3/5",
        iconBg: "bg-chart-3",
      },
      {
        title: "Transactions",
        value: transactionCount,
        format: integer,
        subtitle: "Total logged",
        gradient: "from-chart-4/20 to-chart-4/5",
        iconBg: "bg-chart-4",
      },
    ];
  }, [avgDailyTax, taxShare, todayTax, totalSpent, totalTax, transactionCount, userCurrency]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          className="rounded-xl"
          whileHover={
            reducedMotion
              ? undefined
              : {
                y: -4,
                boxShadow:
                  "0 0 0 1px var(--accent-warm), 0 20px 40px -12px rgba(0,0,0,0.3)",
              }
          }
          transition={{ duration: 0.2 }}
        >
          <Card
            className={cn(
              "relative overflow-hidden border-0 bg-gradient-to-br shadow-lg",
              card.gradient
            )}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div
              className={cn(
                "absolute right-4 top-4 h-12 w-12 rounded-xl opacity-20",
                card.iconBg
              )}
            />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">
                <AnimatedValue value={card.value} format={card.format} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {card.subtitle}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
});
