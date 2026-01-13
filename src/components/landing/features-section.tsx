"use client";

import { motion, type Variants } from "motion/react";
import { Camera, AlertTriangle, TrendingUp, BarChart3 } from "lucide-react";

export function FeaturesSection() {

  const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2, ease: "easeOut" as const }
    }
  };

  return (
    <section id="features" className="mt-24">
      <motion.div
        className="text-center mb-12"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeInUp}
      >
        <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          See what you&apos;re actually paying
        </h2>
        <p className="mt-4 text-lg text-muted-foreground text-pretty">
          Real examples from everyday spending
        </p>
      </motion.div>

      {/* Bento Grid Layout */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Example 1: Coffee Shop Pattern - Large Card */}
        <motion.div
          className="lg:col-span-2 rounded-3xl border border-border bg-card p-6 lg:p-8 cursor-pointer"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <AlertTriangle className="size-3" />
                Quiet Leak Detected
              </div>
              <h3 className="text-2xl font-bold">That daily coffee adds up</h3>
              <p className="mt-2 text-muted-foreground text-pretty">
                You&apos;ve been buying coffee 4 times a week at $5.50 each. Over the last month, that&apos;s $88 in purchases—and $7.04 just in tax.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="text-xs text-muted-foreground">This Month</div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-primary">$7.04</div>
                  <div className="text-xs text-muted-foreground">in tax</div>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="text-xs text-muted-foreground">This Year</div>
                  <div className="mt-1 text-xl font-bold tabular-nums">$84.48</div>
                  <div className="text-xs text-muted-foreground">in tax</div>
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <div className="text-xs text-muted-foreground">Rate</div>
                  <div className="mt-1 text-xl font-bold tabular-nums">8.0%</div>
                  <div className="text-xs text-muted-foreground">avg</div>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 lg:ml-6">
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="space-y-3">
                  {[
                    { date: "Today", amount: "$5.50", tax: "$0.44", scanned: true },
                    { date: "Mon", amount: "$5.50", tax: "$0.44" },
                    { date: "Fri", amount: "$5.50", tax: "$0.44" },
                    { date: "Wed", amount: "$5.50", tax: "$0.44" },
                  ].map((tx, i) => (
                    <div key={i} className="flex items-center justify-between text-sm gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-10">{tx.date}</span>
                        {tx.scanned && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            <Camera className="size-3" />
                            Scanned
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium tabular-nums">{tx.amount}</span>
                        <span className="text-primary font-semibold tabular-nums">{tx.tax}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Example 2: High Tax Merchant - Tall Card */}
        <motion.div
          className="rounded-3xl border border-border bg-card p-6 cursor-pointer"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            <TrendingUp className="size-3" />
            Tax Drag Alert
          </div>
          <h3 className="text-xl font-bold">Higher rates at some merchants</h3>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            Your electronics purchases are taxed at 9.0%—that&apos;s 1% higher than your average.
          </p>

          <div className="mt-6 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold">Electronics Store</div>
                <div className="text-xs text-muted-foreground">Last 3 months</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums">$1,247</div>
                <div className="text-sm text-primary font-semibold tabular-nums">$112 tax</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tax rate</span>
                <span className="font-semibold tabular-nums text-destructive">9.0%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[90%] bg-primary" />
              </div>
              <div className="text-xs text-muted-foreground">
                Above your 8.0% average
              </div>
            </div>
          </div>
        </motion.div>

        {/* Example 3: Monthly Overview - Full Width */}
        <motion.div
          className="md:col-span-2 lg:col-span-3 rounded-3xl border border-border bg-card p-6 lg:p-8 cursor-pointer"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Your tax snapshot</h3>
              <p className="text-sm text-muted-foreground text-pretty">
                See exactly where your money goes, broken down by category and time period.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Today", value: "$2.34", change: "+12%", positive: false },
              { label: "This Week", value: "$18.92", change: "+5%", positive: false },
              { label: "This Month", value: "$87.45", change: "-2%", positive: true },
              { label: "This Year", value: "$1,247", change: "+8%", positive: false },
            ].map((stat, i) => (
              <div key={i} className="rounded-2xl border border-border bg-background p-4">
                <div className="text-xs text-muted-foreground">{stat.label}</div>
                <div className="mt-2 text-2xl font-bold tabular-nums">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  <span className={stat.positive ? "text-primary" : "text-destructive"}>
                    {stat.change}
                  </span>{" "}
                  vs last period
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
