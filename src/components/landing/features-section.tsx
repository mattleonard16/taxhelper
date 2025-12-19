"use client";

import { motion, useReducedMotion } from "motion/react";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeaturesSection() {
  const reducedMotion = useReducedMotion();

  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  // Glow animation for mobile - pulses when in view
  const glowAnimation = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 1, ease: "easeOut" } 
    }
  };

  return (
    <section id="features" className="mt-32">
      <motion.div 
        className="text-center mb-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeInUp}
      >
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          See what you're actually paying
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Real examples from everyday spending
        </p>
      </motion.div>

      <div className="space-y-24">
        {/* Example 1: Coffee Shop Pattern */}
        <motion.div 
          className="group relative"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
        >
          <motion.div 
            className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100"
            variants={glowAnimation} 
          />
          <div className="relative rounded-2xl border border-border bg-card/50 p-4 sm:p-6 lg:p-8 backdrop-blur">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Quiet Leak Detected
                </div>
                <h3 className="mt-4 text-2xl font-bold">That daily coffee adds up</h3>
                <p className="mt-2 text-muted-foreground">
                  You've been buying coffee 4 times a week at $5.50 each. Over the last month, that's $88 in purchases—and $7.04 just in tax.
                </p>
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border bg-card/30 p-4">
                    <div className="text-xs text-muted-foreground">This Month</div>
                    <div className="mt-1 text-xl font-bold">$7.04</div>
                    <div className="text-xs text-muted-foreground">in tax</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card/30 p-4">
                    <div className="text-xs text-muted-foreground">This Year</div>
                    <div className="mt-1 text-xl font-bold">$84.48</div>
                    <div className="text-xs text-muted-foreground">in tax</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card/30 p-4">
                    <div className="text-xs text-muted-foreground">Rate</div>
                    <div className="mt-1 text-xl font-bold">8.0%</div>
                    <div className="text-xs text-muted-foreground">avg</div>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 lg:ml-8">
                <div className="rounded-xl border border-border bg-background p-4 sm:p-6 shadow-lg">
                  <div className="space-y-3">
                    {[
                      { date: "Today", amount: "$5.50", tax: "$0.44", scanned: true },
                      { date: "Mon", amount: "$5.50", tax: "$0.44" },
                      { date: "Fri", amount: "$5.50", tax: "$0.44" },
                      { date: "Wed", amount: "$5.50", tax: "$0.44" },
                    ].map((tx, i) => (
                      <div key={i} className="flex items-center justify-between text-sm gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-12">{tx.date}</span>
                          {tx.scanned && (
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-sm">
                              <Camera className="h-3 w-3" />
                              Scanned
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">{tx.amount}</span>
                          <span className="text-chart-1 font-semibold">{tx.tax}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Example 2: High Tax Merchant */}
        <motion.div 
          className="group relative"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
        >
          <motion.div 
            className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-rose-500/10 via-orange-500/10 to-rose-500/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100"
            variants={glowAnimation}
          />
          <div className="relative rounded-2xl border border-border bg-card/50 p-4 sm:p-6 lg:p-8 backdrop-blur">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-shrink-0 lg:mr-8 order-2 lg:order-1">
                <div className="rounded-xl border border-border bg-background p-4 sm:p-6 shadow-lg">
                  <div className="mb-4 flex items-center justify-between gap-8">
                    <div>
                      <div className="font-semibold">Electronics Store</div>
                      <div className="text-sm text-muted-foreground">Last 3 months</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">$1,247</div>
                      <div className="text-sm text-chart-1 font-semibold">$112 tax</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tax rate</span>
                      <span className="font-semibold text-rose-600">9.0%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[90%] bg-gradient-to-r from-rose-500 to-orange-500" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Above your 8.0% average
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 order-1 lg:order-2">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Tax Drag Alert
                </div>
                <h3 className="mt-4 text-2xl font-bold">Higher rates at some merchants</h3>
                <p className="mt-2 text-muted-foreground">
                  Your electronics purchases are taxed at 9.0%—that's 1% higher than your average. Over $1,247 in spending, that extra 1% cost you $12.47.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Example 3: Monthly Overview */}
        <motion.div 
          className="group relative"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
        >
          <motion.div 
            className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100"
            variants={glowAnimation}
          />
          <div className="relative rounded-2xl border border-border bg-card/50 p-4 sm:p-6 lg:p-8 backdrop-blur">
            <div className="mb-6">
              <h3 className="text-2xl font-bold">Your tax snapshot</h3>
              <p className="mt-2 text-muted-foreground">
                See exactly where your money goes, broken down by category and time period.
              </p>
            </div>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Today", value: "$2.34", change: "+12%" },
                { label: "This Week", value: "$18.92", change: "+5%" },
                { label: "This Month", value: "$87.45", change: "-2%" },
                { label: "This Year", value: "$1,247", change: "+8%" },
              ].map((stat, i) => (
                <div key={i} className="rounded-lg border border-border bg-background/50 p-4">
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                  <div className="mt-2 text-2xl font-bold">{stat.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span className={stat.change.startsWith("+") ? "text-chart-1" : "text-chart-2"}>
                      {stat.change}
                    </span>{" "}
                    vs last period
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
