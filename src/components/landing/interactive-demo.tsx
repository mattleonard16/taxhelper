"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wallet,
  Search,
  ScanLine,
  Receipt,
  PiggyBank,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TABS = [
  {
    id: "tracking",
    label: "Track Every Tax",
    description: "Daily, monthly, and yearly tracking.",
    icon: Wallet,
  },
  {
    id: "deductions",
    label: "Find Deductions",
    description: "Smart detection of write-offs.",
    icon: Search,
  },
  {
    id: "scanner",
    label: "Scan Receipts",
    description: "Snap a photo, get instant data.",
    icon: ScanLine,
  },
];

export function InteractiveDemo() {
  const [activeTab, setActiveTab] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance tabs
  useEffect(() => {
    if (paused) return;

    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % TABS.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [paused]);

  return (
    <section className="mx-auto mt-24 max-w-6xl">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Everything you need for{" "}
          <span className="text-primary">total tax awareness</span>
        </h2>
        <p className="mt-4 text-lg text-muted-foreground text-pretty">
          TaxHelper brings clarity to your finances with powerful tracking and smart insights.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Navigation Panel */}
        <div
          className="flex flex-col gap-3"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {TABS.map((tab, index) => {
            const isActive = activeTab === index;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(index)}
                className={cn(
                  "group relative flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors",
                  isActive
                    ? "border-border bg-card"
                    : "border-transparent hover:border-border hover:bg-card/50"
                )}
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    isActive ? "bg-primary/10" : "bg-muted"
                  )}
                >
                  <tab.icon
                    className={cn(
                      "size-5",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{tab.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {tab.description}
                  </div>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="demo-active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-primary"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Preview Panel */}
        <div
          className="relative min-h-[480px] overflow-hidden rounded-3xl border border-border bg-card p-6"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <AnimatePresence mode="wait">
            {activeTab === 0 && <TrackingDemo key="tracking" />}
            {activeTab === 1 && <DeductionsDemo key="deductions" />}
            {activeTab === 2 && <ScannerDemo key="scanner" />}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

// 1. Tax Tracking Demo
function TrackingDemo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className="relative flex h-full flex-col gap-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Today's Tax"
          value="$12.45"
          subtext="from 3 transactions"
          delay={0.1}
        />
        <StatCard
          label="This Month"
          value="$342.80"
          subtext="+5% vs last month"
          trend="up"
          delay={0.15}
        />
        <StatCard
          label="YTD Tax Paid"
          value="$4,285.12"
          subtext="8.2% effective rate"
          delay={0.2}
        />
        <StatCard
          label="Projected"
          value="$5,100"
          subtext="by end of year"
          highlight
          delay={0.25}
        />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-border bg-background p-4"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium">Recent Activity</div>
          <Badge variant="outline" className="text-xs">Live</Badge>
        </div>
        <div className="space-y-3">
          {[
            { name: "Coffee Shop", time: "2m ago", tax: "$0.45" },
            { name: "Electronics Store", time: "2h ago", tax: "$12.50" },
            { name: "Grocery Market", time: "5h ago", tax: "$3.20" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div className="size-2 rounded-full bg-primary" />
                <span>{item.name}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="text-xs">{item.time}</span>
                <span className="font-mono font-medium tabular-nums text-foreground">{item.tax}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  subtext: string;
  trend?: "up" | "down";
  highlight?: boolean;
  delay?: number;
};

function StatCard({ label, value, subtext, trend, highlight, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.2 }}
      className={cn(
        "flex flex-col justify-between rounded-2xl border p-5",
        highlight
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-background"
      )}
    >
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
      <div className={cn(
        "mt-1 text-xs",
        trend === "up" ? "text-destructive" : "text-muted-foreground"
      )}>
        {subtext}
      </div>
    </motion.div>
  );
}

// 2. Deductions Demo
function DeductionsDemo() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="relative flex h-full flex-col items-center justify-center gap-6 p-4"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-background p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Search className="size-5" />
          </div>
          <div>
            <div className="font-bold">Deduction Found</div>
            <div className="text-xs text-muted-foreground">Just now</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-primary/5 p-4 border border-primary/20">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">Home Office Deduction</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Based on your internet and utility payments
                </div>
              </div>
              <Badge variant="outline">New</Badge>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm px-1">
            <span className="text-muted-foreground">Potential Savings</span>
            <span className="font-bold text-lg tabular-nums text-primary">+$1,240.00</span>
          </div>

          <Button className="w-full">
            Review Details <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </motion.div>

      {/* Floating deduction pills */}
      <motion.div
        className="absolute top-10 right-4 rounded-full bg-card px-3 py-1 text-xs font-medium border border-border text-foreground flex items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Receipt className="size-3" /> <span className="tabular-nums">Meals: $450</span>
      </motion.div>

      <motion.div
        className="absolute bottom-20 left-4 rounded-full bg-card px-3 py-1 text-xs font-medium border border-border text-foreground flex items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <PiggyBank className="size-3" /> <span className="tabular-nums">Travel: $890</span>
      </motion.div>
    </motion.div>
  );
}

// 3. Scanner Demo
function ScannerDemo() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="relative flex h-full items-center justify-center p-4"
    >
      <div className="relative w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-background">
        {/* Receipt Header */}
        <div className="border-b border-dashed border-border bg-muted/30 p-4 text-center">
          <div className="mx-auto size-8 rounded-full bg-muted" />
          <div className="mt-2 h-2 w-24 mx-auto rounded bg-muted" />
          <div className="mt-1 h-2 w-16 mx-auto rounded bg-muted/50" />
        </div>

        {/* Receipt Body */}
        <div className="space-y-3 p-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-2 w-20 rounded bg-muted/50" />
              <div className="h-2 w-8 rounded bg-muted/50" />
            </div>
          ))}

          <div className="my-4 border-t border-dashed border-border" />

          <div className="flex justify-between items-end">
            <div className="h-2 w-12 rounded bg-muted" />
            <motion.div
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.3 }}
              className="text-xl font-bold tabular-nums text-primary"
            >
              $42.50
            </motion.div>
          </div>
        </div>

        {/* Scanning Beam */}
        <motion.div
          className="absolute inset-x-0 top-0 h-0.5 bg-primary"
          initial={{ top: "0%" }}
          animate={{ top: "100%" }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 2
          }}
        />

        {/* Extracted Data Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-4 left-4 right-4 rounded-xl bg-primary p-3 text-primary-foreground"
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            <div className="rounded-full bg-primary-foreground/20 p-1">
              <ScanLine className="size-3" />
            </div>
            Scan Complete
          </div>
          <div className="mt-1 text-xs opacity-90">
            Merchant: Cafe Latte <br/>
            Tax: $3.85 (9.0%)
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
