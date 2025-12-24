"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wallet,
  Sparkles,
  ScanLine,
  ChevronRight,
  Receipt,
  PiggyBank,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TABS = [
  {
    id: "tracking",
    label: "Track Every Tax",
    description: "Daily, monthly, and yearly tracking.",
    icon: Wallet,
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
  },
  {
    id: "deductions",
    label: "Find Deductions",
    description: "AI finds potential write-offs.",
    icon: Sparkles,
    color: "from-purple-500 to-pink-500",
    bg: "bg-purple-500/10",
    text: "text-purple-500",
  },
  {
    id: "scanner",
    label: "Scan Receipts",
    description: "Snap a photo, get instant data.",
    icon: ScanLine,
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
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

  const CurrentTab = TABS[activeTab];

  return (
    <div className="mx-auto mt-24 max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
        {/* Navigation Panel */}
        <div className="flex flex-col justify-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need for <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              total tax awareness
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            TaxHelper brings clarity to your finances with powerful tracking and AI insights.
          </p>

          <div 
            className="mt-8 space-y-3"
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
                    "group relative flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                    isActive
                      ? "border-primary/50 bg-secondary/50 shadow-lg"
                      : "border-transparent hover:bg-secondary/30"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isActive ? "bg-background shadow-sm" : "bg-muted"
                    )}
                  >
                    <tab.icon
                      className={cn(
                        "h-5 w-5",
                        isActive ? tab.text : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div>
                    <div className="font-semibold">{tab.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {tab.description}
                    </div>
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute inset-0 rounded-xl border-2 border-primary/20"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview Panel */}
        <div 
          className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-muted/50 p-6 shadow-2xl lg:aspect-auto lg:h-[600px]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Background Gradient */}
          <div className={cn(
            "absolute inset-0 opacity-20 transition-colors duration-700 bg-gradient-to-br",
            CurrentTab.color
          )} />

          <AnimatePresence mode="wait">
            {activeTab === 0 && <TrackingDemo key="tracking" />}
            {activeTab === 1 && <DeductionsDemo key="deductions" />}
            {activeTab === 2 && <ScannerDemo key="scanner" />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// 1. Tax Tracking Demo
function TrackingDemo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative flex h-full flex-col justify-center gap-6"
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
          delay={0.2}
        />
        <StatCard 
          label="YTD Tax Paid" 
          value="$4,285.12" 
          subtext="8.2% effective rate"
          delay={0.3}
        />
        <StatCard 
          label="Projected" 
          value="$5,100" 
          subtext="by end of year"
          highlight
          delay={0.4}
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6 }}
        className="rounded-xl border border-border bg-background/80 p-4 backdrop-blur"
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
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{item.name}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="text-xs">{item.time}</span>
                <span className="font-mono font-medium text-foreground">{item.tax}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ label, value, subtext, trend, highlight, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring" }}
      className={cn(
        "flex flex-col justify-between rounded-2xl border p-5 shadow-sm backdrop-blur",
        highlight 
          ? "border-primary/20 bg-primary/5" 
          : "border-border bg-background/60"
      )}
    >
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      <div className={cn(
        "mt-1 text-xs",
        trend === "up" ? "text-rose-500" : "text-muted-foreground"
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
      className="relative flex h-full flex-col items-center justify-center gap-6 p-4"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold">AI Insight Found</div>
            <div className="text-xs text-muted-foreground">Just now</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-purple-50 p-4 border border-purple-100">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-purple-900">Home Office Deduction</div>
                <div className="text-xs text-purple-700 mt-1">
                  Based on your internet and utility payments
                </div>
              </div>
              <Badge className="bg-purple-600 hover:bg-purple-700">New</Badge>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm px-1">
            <span className="text-muted-foreground">Potential Savings</span>
            <span className="font-bold text-lg text-emerald-600">+$1,240.00</span>
          </div>

          <Button className="w-full bg-purple-600 hover:bg-purple-700">
            Review Details <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Floating deduction pills */}
      <motion.div 
        className="absolute top-10 right-0 rounded-full bg-white px-3 py-1 text-xs font-medium shadow-lg border border-border text-orange-600 flex items-center gap-1"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Receipt className="h-3 w-3" /> Meals: $450
      </motion.div>
      
      <motion.div 
        className="absolute bottom-20 left-4 rounded-full bg-white px-3 py-1 text-xs font-medium shadow-lg border border-border text-blue-600 flex items-center gap-1"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <PiggyBank className="h-3 w-3" /> Travel: $890
      </motion.div>
    </motion.div>
  );
}

// 3. Scanner Demo
function ScannerDemo() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="relative flex h-full items-center justify-center p-4 pb-8"
    >
      <div className="relative w-full max-w-xs overflow-hidden rounded-xl border border-border bg-white shadow-2xl dark:bg-zinc-900">
        {/* Receipt Header */}
        <div className="border-b border-dashed border-border bg-muted/30 p-4 text-center">
          <div className="mx-auto h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-2 w-24 mx-auto rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-1 h-2 w-16 mx-auto rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>

        {/* Receipt Body */}
        <div className="space-y-3 p-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-2 w-20 rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-2 w-8 rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ))}
          
          <div className="my-4 border-t border-dashed border-border" />
          
          <div className="flex justify-between items-end">
            <div className="h-2 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
            <motion.div 
              initial={{ scale: 0.8, color: "#71717a" }}
              animate={{ scale: 1.1, color: "#10b981" }}
              transition={{ delay: 1.5, duration: 0.5 }}
              className="text-xl font-bold"
            >
              $42.50
            </motion.div>
          </div>
        </div>

        {/* Scanning Beam */}
        <motion.div
          className="absolute inset-x-0 top-0 h-1 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="absolute bottom-4 left-4 right-4 rounded-lg bg-emerald-500/90 p-3 text-white backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            <div className="rounded-full bg-white/20 p-1">
              <ScanLine className="h-3 w-3" />
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

