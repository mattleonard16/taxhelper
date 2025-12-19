"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Check if we're in development mode
const isDev = process.env.NODE_ENV === "development";
const hasGoogle = process.env.NEXT_PUBLIC_HAS_GOOGLE_AUTH === "true";
const hasEmail = process.env.NEXT_PUBLIC_HAS_EMAIL_AUTH === "true";
const hasAnyProdAuth = hasGoogle || hasEmail;

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [devEmail, setDevEmail] = useState("");
  const [devPassword, setDevPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn("email", { email, callbackUrl: "/dashboard" });
      setEmailSent(true);
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDevSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: devEmail || "test@example.com",
        password: devPassword,
        callbackUrl: "/dashboard",
        redirect: true,
      });
      if (result?.error) {
        console.error("Dev sign in error:", result.error);
      }
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-1/4 h-[400px] w-[400px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-accent/20 blur-[100px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.2_0.02_280/0.1)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.2_0.02_280/0.1)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
              <span className="text-xl font-bold text-primary-foreground">T</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">TaxHelper</span>
          </Link>
        </div>

        <Card className="border-0 bg-card/80 shadow-2xl backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in to continue tracking your taxes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {hasEmail && emailSent ? (
              <div className="rounded-lg bg-chart-1/10 p-4 text-center">
                <div className="mb-2 text-chart-1">✓</div>
                <p className="font-medium">Check your email</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a sign-in link to <strong>{email}</strong>
                </p>
              </div>
            ) : (
              <>
                {/* Development Sign In - only in dev mode */}
                {isDev && (
                  <>
                    <div className="rounded-lg border-2 border-dashed border-amber-500/50 bg-amber-500/10 p-4">
                      <p className="mb-3 text-center text-sm font-medium text-amber-600 dark:text-amber-400">
                        🔧 Development Mode
                      </p>
                      <form onSubmit={handleDevSignIn} className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="dev-email">Email (any)</Label>
                          <Input
                            id="dev-email"
                            type="email"
                            placeholder="test@example.com"
                            value={devEmail}
                            onChange={(e) => setDevEmail(e.target.value)}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dev-password">Password</Label>
                          <Input
                            id="dev-password"
                            type="password"
                            placeholder="dev"
                            value={devPassword}
                            onChange={(e) => setDevPassword(e.target.value)}
                            required
                            className="h-10"
                          />
                        </div>
                        <Button
                          type="submit"
                          variant="outline"
                          className="w-full border-amber-500/50 hover:bg-amber-500/20"
                          disabled={loading}
                        >
                          {loading ? "Signing in..." : "Dev Sign In"}
                        </Button>
                      </form>
                    </div>
                    {hasAnyProdAuth && (
                      <div className="relative">
                        <Separator />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                          or use production auth
                        </span>
                      </div>
                    )}
                  </>
                )}

                {!isDev && !hasAnyProdAuth ? (
                  <div className="rounded-lg border border-border bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
                    No authentication providers configured.
                  </div>
                ) : (
                  <>
                    {/* Google Sign In */}
                    {hasGoogle && (
                      <Button
                        variant="outline"
                        className="w-full h-11"
                        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                      >
                        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Continue with Google
                      </Button>
                    )}

                    {hasGoogle && hasEmail && (
                      <div className="relative">
                        <Separator />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                          or
                        </span>
                      </div>
                    )}

                    {/* Email Sign In */}
                    {hasEmail && (
                      <form onSubmit={handleEmailSignIn} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-11"
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full h-11 bg-gradient-to-r from-primary to-accent"
                          disabled={loading}
                        >
                          {loading ? "Sending link..." : "Sign in with Email"}
                        </Button>
                      </form>
                    )}
                  </>
                )}
              </>
            )}

            <p className="text-center text-xs text-muted-foreground">
              By signing in, you agree to our terms of service and privacy policy.
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
