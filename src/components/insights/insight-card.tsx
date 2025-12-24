"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingUp,
  Copy,
  Repeat,
  BadgeDollarSign,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  HelpCircle,
  X,
} from "lucide-react";
import type { Insight } from "@/lib/insights";
import type { Transaction } from "@/types";
import { TransactionList } from "@/components/transactions/transaction-list";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";

interface InsightCardProps {
  insight: Insight;
  transactions: Transaction[];
  onEditTransaction?: (transaction: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
  onUpdateInsightState?: (
    insightId: string,
    updates: { pinned?: boolean; dismissed?: boolean }
  ) => void;
}

const INSIGHT_ICONS = {
  QUIET_LEAK: Repeat,
  TAX_DRAG: TrendingUp,
  SPIKE: AlertTriangle,
  DUPLICATE: Copy,
  DEDUCTION: BadgeDollarSign,
} as const;

const INSIGHT_COLORS = {
  QUIET_LEAK: "bg-amber-500/20 text-amber-600 border-amber-500/30",
  TAX_DRAG: "bg-rose-500/20 text-rose-600 border-rose-500/30",
  SPIKE: "bg-orange-500/20 text-orange-600 border-orange-500/30",
  DUPLICATE: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  DEDUCTION: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
} as const;

function getSeverityColor(score: number): string {
  if (score >= 8) return "bg-rose-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-emerald-500";
}

function getSeverityLabel(score: number): string {
  if (score >= 8) return "High";
  if (score >= 5) return "Medium";
  return "Low";
}

export function InsightCard({
  insight,
  transactions,
  onEditTransaction,
  onDeleteTransaction,
  onUpdateInsightState,
}: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [explanationVisible, setExplanationVisible] = useState(false);
  const [extraTransactions, setExtraTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isDismissed = insight.dismissed ?? false;
  const isPinned = insight.pinned ?? false;
  const canUpdateState = Boolean(onUpdateInsightState && insight.id);
  const reducedMotion = useReducedMotion();

  const supportingIds = useMemo(
    () => Array.from(new Set(insight.supportingTransactionIds)).sort(),
    [insight.supportingTransactionIds]
  );

  const supportingIdsKey = useMemo(() => supportingIds.join(","), [supportingIds]);

  const insightKey = useMemo(() => `${insight.type}-${supportingIdsKey}`, [insight.type, supportingIdsKey]);

  useEffect(() => {
    setExtraTransactions([]);
    setLoadError(null);
    setLoadingTransactions(false);
  }, [insightKey]);

  const Icon = INSIGHT_ICONS[insight.type] ?? TrendingUp;
  const colorClass = INSIGHT_COLORS[insight.type] ?? "bg-slate-500/20 text-slate-600 border-slate-500/30";

  const supportingIdSet = useMemo(() => new Set(supportingIds), [supportingIds]);

  const loadedTransactionMap = useMemo(() => {
    const map = new Map<string, Transaction>();

    for (const transaction of transactions) {
      if (supportingIdSet.has(transaction.id)) {
        map.set(transaction.id, transaction);
      }
    }

    for (const transaction of extraTransactions) {
      if (supportingIdSet.has(transaction.id)) {
        map.set(transaction.id, transaction);
      }
    }

    return map;
  }, [transactions, extraTransactions, supportingIdSet]);

  const supportingTransactions = useMemo(() => {
    return Array.from(loadedTransactionMap.values()).sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [loadedTransactionMap]);

  const missingIds = useMemo(() => {
    return supportingIds.filter((id) => !loadedTransactionMap.has(id));
  }, [supportingIds, loadedTransactionMap]);

  const fetchMissingTransactions = useCallback(async () => {
    if (missingIds.length === 0) return;

    setLoadingTransactions(true);
    setLoadError(null);

    try {
      const chunkSize = 50;
      const fetched: Transaction[] = [];

      for (let i = 0; i < missingIds.length; i += chunkSize) {
        const chunk = missingIds.slice(i, i + chunkSize);
        const idsParam = encodeURIComponent(chunk.join(","));
        const response = await fetch(`/api/transactions?ids=${idsParam}`);

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();
        if (Array.isArray(data.transactions)) {
          fetched.push(...data.transactions);
        }
      }

      setExtraTransactions((prev) => {
        const map = new Map<string, Transaction>();
        for (const transaction of prev) {
          map.set(transaction.id, transaction);
        }
        for (const transaction of fetched) {
          map.set(transaction.id, transaction);
        }
        return Array.from(map.values());
      });
    } catch {
      setLoadError("Failed to load transactions");
    } finally {
      setLoadingTransactions(false);
    }
  }, [missingIds]);

  const handleEdit = useCallback(
    (transaction: Transaction) => {
      onEditTransaction?.(transaction);
    },
    [onEditTransaction]
  );

  const handleDelete = useCallback(
    (id: string) => {
      onDeleteTransaction?.(id);
    },
    [onDeleteTransaction]
  );

  const handleTogglePinned = useCallback(() => {
    if (!insight.id || !onUpdateInsightState) return;
    onUpdateInsightState(insight.id, { pinned: !isPinned });
  }, [insight.id, isPinned, onUpdateInsightState]);

  const handleToggleDismissed = useCallback(() => {
    if (!insight.id || !onUpdateInsightState) return;
    onUpdateInsightState(insight.id, { dismissed: !isDismissed });
  }, [insight.id, isDismissed, onUpdateInsightState]);

  return (
    <motion.div
      className={cn("rounded-xl", isDismissed && "opacity-60")}
      initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
      animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      whileHover={
        reducedMotion
          ? undefined
          : {
            y: -4,
            boxShadow:
              "0 0 0 1px rgba(148,163,184,0.15), 0 18px 38px -16px rgba(0,0,0,0.4)",
          }
      }
      transition={{ duration: 0.2 }}
    >
      <Card className="border-0 bg-card/50 shadow-lg backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={cn("rounded-lg p-2", colorClass)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg font-semibold leading-tight">
                  {insight.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{insight.summary}</p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge
                  variant="outline"
                  className={cn("border px-2 py-0.5 text-xs font-medium", colorClass)}
                >
                  {insight.type.replace("_", " ")}
                </Badge>
                {isPinned && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                    Pinned
                  </Badge>
                )}
                {isDismissed && (
                  <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                    Dismissed
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {getSeverityLabel(insight.severityScore)}
                </span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-2 w-1.5 rounded-full",
                        i < insight.severityScore
                          ? getSeverityColor(insight.severityScore)
                          : "bg-muted"
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={isPinned ? "Unpin insight" : "Pin insight"}
                  aria-pressed={isPinned}
                  disabled={!canUpdateState}
                  onClick={handleTogglePinned}
                >
                  {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={isDismissed ? "Restore insight" : "Dismiss insight"}
                  aria-pressed={isDismissed}
                  disabled={!canUpdateState}
                  onClick={handleToggleDismissed}
                >
                  {isDismissed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Why am I seeing this? section */}
          {insight.explanation && (
            <div className="mb-3">
              {!explanationVisible ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Why am I seeing this?"
                  onClick={() => setExplanationVisible(true)}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Why am I seeing this?
                </Button>
              ) : (
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Why am I seeing this?</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label="Hide explanation"
                      onClick={() => setExplanationVisible(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  
                  <p className="mb-3 text-sm text-muted-foreground">
                    {insight.explanation.reason}
                  </p>
                  
                  {insight.explanation.thresholds.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Thresholds met:
                      </span>
                      <div className="grid gap-1.5">
                        {insight.explanation.thresholds.map((threshold, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded bg-background/50 px-2 py-1 text-xs"
                          >
                            <span className="capitalize text-muted-foreground">
                              {threshold.name}
                            </span>
                            <span className="font-mono">
                              <span className="text-foreground">{String(threshold.actual)}</span>
                              <span className="mx-1 text-muted-foreground/60">vs</span>
                              <span className="text-muted-foreground">{String(threshold.threshold)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {insight.explanation.suggestion && (
                    <p className="rounded bg-primary/5 px-2 py-1.5 text-xs text-muted-foreground">
                      <span className="font-medium">Suggestion:</span>{" "}
                      {insight.explanation.suggestion}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} transactions for ${insight.title}`}
            onClick={() => {
              const nextExpanded = !expanded;
              setExpanded(nextExpanded);

              if (nextExpanded && missingIds.length > 0 && !loadingTransactions) {
                void fetchMissingTransactions();
              }
            }}
          >
            {expanded ? (
              <>
                Hide transactions <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                View {supportingIds.length} transaction
                {supportingIds.length !== 1 ? "s" : ""}{" "}
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>

          {expanded && (
            <div className="mt-4 space-y-3">
              {loadError && (
                <p className="text-sm text-destructive">{loadError}</p>
              )}

              {loadingTransactions && supportingTransactions.length === 0 && (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              )}

              {supportingTransactions.length > 0 ? (
                <TransactionList
                  transactions={supportingTransactions}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ) : !loadingTransactions && !loadError ? (
                <p className="text-sm text-muted-foreground">
                  No transactions found.
                </p>
              ) : null}

              {loadingTransactions && supportingTransactions.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Loading remaining transactions…
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
