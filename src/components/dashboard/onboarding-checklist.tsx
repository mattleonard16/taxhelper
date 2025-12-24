"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Circle,
  Plus,
  Receipt,
  Settings,
  Lightbulb,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { OnboardingStatus } from "@/app/api/onboarding/route";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  completed: boolean;
}

interface OnboardingChecklistProps {
  onAddTransaction: () => void;
  onRefreshData: () => void;
}

export function OnboardingChecklist({
  onAddTransaction,
  onRefreshData,
}: OnboardingChecklistProps) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSampleData, setLoadingSampleData] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/onboarding");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error("Error fetching onboarding status:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Check localStorage for dismissal
  useEffect(() => {
    const isDismissed = localStorage.getItem("onboarding-dismissed") === "true";
    setDismissed(isDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("onboarding-dismissed", "true");
    setDismissed(true);
  };

  const handleLoadSampleData = async () => {
    setLoadingSampleData(true);
    try {
      const response = await fetch("/api/sample-data", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to load sample data");
      }

      const data = await response.json();

      if (data.alreadyExisted) {
        toast.info("Sample data was already loaded");
      } else {
        toast.success(`Loaded ${data.created} sample transactions`);
      }

      // Refresh dashboard data and onboarding status
      await fetchStatus();
      onRefreshData();
    } catch (error) {
      console.error("Error loading sample data:", error);
      toast.error("Failed to load sample data");
    } finally {
      setLoadingSampleData(false);
    }
  };

  // Don't render if loading, dismissed, or all complete
  if (loading) {
    return null;
  }

  if (dismissed || status?.allComplete) {
    return null;
  }

  const checklistItems: ChecklistItem[] = [
    {
      id: "transaction",
      label: "Add 1 transaction",
      description: "Start tracking your spending",
      href: "#",
      icon: Plus,
      completed: status?.hasTransaction ?? false,
    },
    {
      id: "receipt",
      label: "Scan 1 receipt",
      description: "Upload a receipt for OCR",
      href: "/transactions",
      icon: Receipt,
      completed: status?.hasReceipt ?? false,
    },
    {
      id: "taxrate",
      label: "Set your tax rate",
      description: "Configure your default rate",
      href: "/settings",
      icon: Settings,
      completed: status?.hasTaxRate ?? false,
    },
    {
      id: "insight",
      label: "See your first insight",
      description: "Discover spending patterns",
      href: "/insights",
      icon: Lightbulb,
      completed: status?.hasInsight ?? false,
    },
  ];

  const completedCount = checklistItems.filter((item) => item.completed).length;
  const progress = (completedCount / checklistItems.length) * 100;

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent shadow-lg">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss onboarding"
      >
        <X className="h-4 w-4" />
      </button>

      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Get Started</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Complete these steps to get the most out of TaxHelper
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{completedCount} of {checklistItems.length} complete</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Checklist items */}
        <ul className="space-y-2">
          {checklistItems.map((item) => {
            const Icon = item.icon;
            const isTransaction = item.id === "transaction";

            const content = (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg p-3 transition-colors",
                  item.completed
                    ? "bg-muted/50"
                    : "bg-background/80 hover:bg-background"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    item.completed
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      item.completed && "text-muted-foreground line-through"
                    )}
                  >
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 flex-shrink-0 text-muted-foreground/50" />
                )}
              </div>
            );

            if (item.completed) {
              return <li key={item.id}>{content}</li>;
            }

            if (isTransaction) {
              return (
                <li key={item.id}>
                  <button
                    onClick={onAddTransaction}
                    className="w-full text-left"
                  >
                    {content}
                  </button>
                </li>
              );
            }

            return (
              <li key={item.id}>
                <Link href={item.href} className="block">
                  {content}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Sample data button */}
        {!status?.sampleDataLoaded && (
          <div className="border-t pt-4">
            <Button
              onClick={handleLoadSampleData}
              disabled={loadingSampleData}
              variant="outline"
              className="w-full bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20"
            >
              {loadingSampleData ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading sample data...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Load sample data to explore
                </>
              )}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Creates demo transactions so you can see charts and insights
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
