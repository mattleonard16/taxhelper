"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log to console (ready for Sentry or other error tracking)
        console.error("App error:", error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                <svg
                    className="h-10 w-10 text-destructive"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
            </div>
            <div>
                <h2 className="text-2xl font-bold">Something went wrong</h2>
                <p className="mt-2 text-muted-foreground">
                    We encountered an unexpected error. Please try again.
                </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
                <Button onClick={reset} size="lg">
                    Try again
                </Button>
                <Button asChild size="lg" variant="outline">
                    <Link href="/">Go home</Link>
                </Button>
            </div>

            {process.env.NODE_ENV === "development" && (
                <details className="w-full max-w-2xl rounded-lg border border-border bg-card/50 p-4 text-left">
                    <summary className="cursor-pointer text-sm font-medium">
                        Error details
                    </summary>
                    <pre className="mt-3 overflow-auto text-xs text-muted-foreground">
                        {error.message}
                        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
                    </pre>
                </details>
            )}
        </div>
    );
}
