import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { HeroElasticLine } from "@/components/landing/hero-elastic-line";
import { FeaturesSection } from "@/components/landing/features-section";

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-accent/20 blur-[100px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.2_0.02_280/0.1)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.2_0.02_280/0.1)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 bg-background/50 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
              <span className="text-lg font-bold text-primary-foreground">T</span>
            </div>
            <span className="text-xl font-bold tracking-tight">TaxHelper</span>
          </div>
          <Button asChild>
            <Link href="/auth/signin">Sign In</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-chart-1" />
            Tax awareness made simple
          </div>

          <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            See where your money{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              actually goes
            </span>{" "}
            in tax
          </h1>

          {/* Elastic Line */}
          <div className="mx-auto max-w-2xl">
            <HeroElasticLine />
          </div>

          <p className="mx-auto mt-2 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Track every purchase and paycheck. Understand how much tax you pay daily,
            monthly, and yearly. No filing, no advice—just awareness.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="h-12 px-8 text-lg bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
              asChild
            >
              <Link href="/auth/signin">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-lg" asChild>
              <Link href="#features">Learn More</Link>
            </Button>
          </div>
        </div>

        {/* Features - Real Examples */}
        <FeaturesSection />

        {/* CTA */}
        <section className="mt-32 text-center">
          <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-gradient-to-br from-card to-card/50 p-12 shadow-2xl backdrop-blur">
            <h2 className="text-3xl font-bold tracking-tight">
              Start tracking your taxes today
            </h2>
            <p className="mt-4 text-muted-foreground">
              Free to use. No credit card required. Just sign up and start logging.
            </p>
            <Button
              size="lg"
              className="mt-8 h-12 px-8 text-lg bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25"
              asChild
            >
              <Link href="/auth/signin">Get Started Free</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-32 border-t border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
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
