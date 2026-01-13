"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { useCurrency } from "@/hooks/use-user-settings";
import { Receipt, FileCheck, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReceiptStatsProps {
    receipts: {
        total: number;
        processed: number;
        pending: number;
        failed: number;
    };
    tax: {
        totalPaid: string;
        totalSpent: string;
        transactionCount: number;
    };
}

export function ReceiptOrchestrationStats({
    receipts,
    tax,
}: ReceiptStatsProps) {
    const userCurrency = useCurrency();

    const cards = [
        {
            title: "Receipts Processed",
            value: receipts.processed,
            subtitle: `${receipts.pending} pending · ${receipts.failed} failed`,
            icon: FileCheck,
            gradient: "from-emerald-500/20 to-emerald-500/5",
            iconColor: "text-emerald-500",
        },
        {
            title: "Total Tax Paid",
            value: formatCurrency(parseFloat(tax.totalPaid), userCurrency),
            subtitle: `From ${tax.transactionCount} transactions`,
            icon: Receipt,
            gradient: "from-rose-500/20 to-rose-500/5",
            iconColor: "text-rose-500",
        },
    ];

    // Only show error card if there are failures
    if (receipts.failed > 0) {
        cards.push({
            title: "Needs Attention",
            value: receipts.failed,
            subtitle: "Failed to process",
            icon: AlertCircle,
            gradient: "from-amber-500/20 to-amber-500/5",
            iconColor: "text-amber-500",
        });
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Receipt Intelligence</h2>
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/receipts">
                        View inbox <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {cards.map((card) => (
                    <Card
                        key={card.title}
                        className={cn(
                            "relative overflow-hidden border-0 bg-gradient-to-br shadow-lg transition-all hover:shadow-xl",
                            card.gradient
                        )}
                    >
                        <div className="absolute right-4 top-4">
                            <card.icon className={cn("h-8 w-8 opacity-50", card.iconColor)} />
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {card.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold tracking-tight">
                                {typeof card.value === "number" ? card.value : card.value}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {card.subtitle}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
