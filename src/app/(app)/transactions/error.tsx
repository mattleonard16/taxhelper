"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function TransactionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Transactions error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div>
        <h2 className="text-2xl font-bold">Transactions are unavailable</h2>
        <p className="mt-2 text-muted-foreground">
          We could not load transactions right now. Please try again.
        </p>
      </div>
      <Button onClick={reset} size="lg">
        Try again
      </Button>
    </div>
  );
}
