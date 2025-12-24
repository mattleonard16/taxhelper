"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpPage() {
    const router = useRouter();
    const { status } = useSession();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Redirect if already authenticated
    useEffect(() => {
        if (status === "authenticated") {
            router.push("/dashboard");
        }
    }, [status, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        // Validation
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, name }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Registration failed");
                setLoading(false);
                return;
            }

            // Redirect to sign-in page on success
            router.push("/auth/signin?registered=true");
        } catch {
            setError("An error occurred. Please try again.");
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
                        <CardTitle className="text-2xl">Create an account</CardTitle>
                        <CardDescription>
                            Start tracking your taxes today
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {error && (
                            <div className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name (optional)</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="Your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="h-11"
                                />
                            </div>

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

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="At least 8 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm Password</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    placeholder="Confirm your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 bg-gradient-to-r from-primary to-accent"
                                disabled={loading}
                            >
                                {loading ? "Creating account..." : "Create Account"}
                            </Button>
                        </form>

                        <p className="text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/auth/signin" className="text-primary hover:underline">
                                Sign in
                            </Link>
                        </p>

                        <p className="text-center text-xs text-muted-foreground">
                            By creating an account, you agree to our terms of service and privacy policy.
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
