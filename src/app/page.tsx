import { redirect } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getSession } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { FeaturesSection } from "@/components/landing/features-section";
import { ArrowRight, Receipt, TrendingUp, Search } from "lucide-react";

const InteractiveDemo = dynamic(
  () =>
    import("@/components/landing/interactive-demo").then(
      (mod) => mod.InteractiveDemo
    ),
  {
    loading: () => <InteractiveDemoSkeleton />,
  }
);

function InteractiveDemoSkeleton() {
  return (
    <section className="mx-auto mt-24 max-w-6xl">
      <div className="text-center mb-12">
        <div className="mx-auto h-8 w-2/3 rounded-lg bg-muted" />
        <div className="mx-auto mt-4 h-4 w-1/2 rounded-lg bg-muted/70" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-16 rounded-2xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-[480px] rounded-3xl border border-border bg-card" />
      </div>
    </section>
  );
}

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-dvh">
      {/* Subtle grid background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.22_0.01_260/0.4)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.22_0.01_260/0.4)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary">
              <span className="text-lg font-bold text-primary-foreground">T</span>
            </div>
            <span className="text-xl font-bold tracking-tight">TaxHelper</span>
          </div>
          <Button asChild>
            <Link href="/auth/signin">Sign In</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Bento Hero Grid */}
        <section className="grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
          {/* Main Hero Card - spans 2 columns */}
          <div className="lg:col-span-2 lg:row-span-2 rounded-3xl border border-border bg-card p-8 lg:p-12 flex flex-col justify-between">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-muted-foreground">
                <span className="size-2 rounded-full bg-primary" />
                Tax awareness made simple
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                See where your money{" "}
                <span className="text-primary">
                  actually goes
                </span>{" "}
                in tax
              </h1>

              <p className="mt-6 max-w-xl text-lg text-muted-foreground text-pretty">
                Track every purchase and paycheck. Understand how much tax you pay daily,
                monthly, and yearly. No filing, no advice—just awareness.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button size="lg" className="h-12 px-8 text-lg" asChild>
                <Link href="/auth/signin">
                  Get Started Free
                  <ArrowRight className="ml-2 size-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-lg" asChild>
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </div>

          {/* Stat Card 1 */}
          <div className="rounded-3xl border border-border bg-card p-6 flex flex-col justify-between cursor-pointer">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <Receipt className="size-6 text-primary" />
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold tabular-nums">$4,285</div>
              <div className="text-sm text-muted-foreground">Average YTD tax tracked</div>
            </div>
          </div>

          {/* Stat Card 2 */}
          <div className="rounded-3xl border border-border bg-card p-6 flex flex-col justify-between cursor-pointer">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <TrendingUp className="size-6 text-primary" />
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold tabular-nums">8.2%</div>
              <div className="text-sm text-muted-foreground">Avg effective tax rate</div>
            </div>
          </div>
        </section>

        {/* Feature Highlights - Bento Row */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <Receipt className="size-5 text-primary" />
              </div>
              <h3 className="font-semibold">Receipt Scanning</h3>
            </div>
            <p className="text-sm text-muted-foreground text-pretty">
              Snap a photo, get instant tax extraction with OCR.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <Search className="size-5 text-primary" />
              </div>
              <h3 className="font-semibold">Smart Detection</h3>
            </div>
            <p className="text-sm text-muted-foreground text-pretty">
              Find potential deductions and spending patterns automatically.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 cursor-pointer sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <h3 className="font-semibold">Visual Analytics</h3>
            </div>
            <p className="text-sm text-muted-foreground text-pretty">
              Charts and trends showing your tax burden over time.
            </p>
          </div>
        </section>

        {/* Interactive Demo */}
        <InteractiveDemo />

        {/* Features - Real Examples */}
        <FeaturesSection />

        {/* CTA - Bento Style */}
        <section className="mt-24">
          <div className="rounded-3xl border border-border bg-card p-8 lg:p-12">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-balance lg:text-4xl">
                  Start tracking your taxes today
                </h2>
                <p className="mt-4 text-lg text-muted-foreground text-pretty">
                  Free to use. No credit card required. Just sign up and start logging.
                </p>
                <Button size="lg" className="mt-8 h-12 px-8 text-lg" asChild>
                  <Link href="/auth/signin">
                    Get Started Free
                    <ArrowRight className="ml-2 size-5" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border bg-background p-4 text-center">
                  <div className="text-2xl font-bold text-primary">Free</div>
                  <div className="text-sm text-muted-foreground">Forever</div>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4 text-center">
                  <div className="text-2xl font-bold tabular-nums">5 min</div>
                  <div className="text-sm text-muted-foreground">Setup time</div>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4 text-center">
                  <div className="text-2xl font-bold">Smart</div>
                  <div className="text-sm text-muted-foreground">Detection</div>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4 text-center">
                  <div className="text-2xl font-bold tabular-nums">100%</div>
                  <div className="text-sm text-muted-foreground">Private</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">T</span>
              </div>
              <span className="font-semibold">TaxHelper</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} TaxHelper. Tax awareness, not advice.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
