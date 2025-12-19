"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global error:", error);
    }, [error]);

    return (
        <html lang="en" className="dark">
            <body className="bg-background text-foreground">
                <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
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
                            A critical error occurred. Please try again.
                        </p>
                    </div>
                    <button
                        onClick={reset}
                        className="rounded-lg bg-gradient-to-r from-primary to-accent px-6 py-3 font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
                    >
                        Try again
                    </button>

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
            </body>
        </html>
    );
}
