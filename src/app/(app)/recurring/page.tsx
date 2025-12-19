"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { TYPE_LABELS } from "@/lib/constants";

interface RecurringTransaction {
    id: string;
    label: string;
    description: string | null;
    merchant: string | null;
    amount: string;
    taxRate: string;
    type: string;
    currency: string;
    frequency: string;
    dayOfMonth: number | null;
    nextRunDate: string;
    lastRunDate: string | null;
    isActive: boolean;
}

const FREQUENCY_LABELS: Record<string, string> = {
    WEEKLY: "Weekly",
    BIWEEKLY: "Every 2 Weeks",
    MONTHLY: "Monthly",
};

export default function RecurringPage() {
    const [loading, setLoading] = useState(true);
    const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [label, setLabel] = useState("");
    const [merchant, setMerchant] = useState("");
    const [amount, setAmount] = useState("");
    const [taxRate, setTaxRate] = useState("");
    const [type, setType] = useState<string>("SALES_TAX");
    const [frequency, setFrequency] = useState<string>("MONTHLY");
    const [dayOfMonth, setDayOfMonth] = useState("");
    const [nextRunDate, setNextRunDate] = useState("");

    const fetchRecurring = useCallback(async () => {
        try {
            const response = await fetch("/api/recurring");
            if (response.ok) {
                const data = await response.json();
                setRecurring(data.recurring);
            }
        } catch (error) {
            console.error("Error fetching recurring:", error);
            toast.error("Failed to load recurring transactions");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRecurring();
    }, [fetchRecurring]);

    const resetForm = () => {
        setLabel("");
        setMerchant("");
        setAmount("");
        setTaxRate("");
        setType("SALES_TAX");
        setFrequency("MONTHLY");
        setDayOfMonth("");
        setNextRunDate(new Date().toISOString().split("T")[0]);
        setEditingId(null);
    };

    const openCreate = () => {
        resetForm();
        setFormOpen(true);
    };

    const openEdit = (r: RecurringTransaction) => {
        setLabel(r.label);
        setMerchant(r.merchant || "");
        setAmount(r.amount);
        setTaxRate((parseFloat(r.taxRate) * 100).toFixed(3));
        setType(r.type);
        setFrequency(r.frequency);
        setDayOfMonth(r.dayOfMonth?.toString() || "");
        setNextRunDate(new Date(r.nextRunDate).toISOString().split("T")[0]);
        setEditingId(r.id);
        setFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const body = {
                label,
                merchant: merchant || undefined,
                amount: parseFloat(amount),
                taxRate: parseFloat(taxRate) / 100,
                type,
                frequency,
                dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : undefined,
                nextRunDate,
            };

            const response = await fetch(
                editingId ? `/api/recurring/${editingId}` : "/api/recurring",
                {
                    method: editingId ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to save");
            }

            toast.success(editingId ? "Updated!" : "Created!");
            setFormOpen(false);
            fetchRecurring();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Something went wrong";
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this recurring transaction?")) return;

        try {
            const response = await fetch(`/api/recurring/${id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete");
            }

            toast.success("Deleted");
            fetchRecurring();
        } catch {
            toast.error("Failed to delete");
        }
    };

    const toggleActive = async (r: RecurringTransaction) => {
        try {
            const response = await fetch(`/api/recurring/${r.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !r.isActive }),
            });

            if (!response.ok) {
                throw new Error("Failed to update");
            }

            toast.success(r.isActive ? "Paused" : "Resumed");
            fetchRecurring();
        } catch {
            toast.error("Failed to update");
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[300px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Recurring Transactions</h1>
                    <p className="mt-1 text-muted-foreground">
                        Automatically generate transactions on a schedule
                    </p>
                </div>
                <Button onClick={openCreate}>+ Add Recurring</Button>
            </div>

            {recurring.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-muted-foreground">No recurring transactions yet</p>
                        <Button variant="outline" className="mt-4" onClick={openCreate}>
                            Create your first one
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {recurring.map((r) => (
                        <Card key={r.id} className={!r.isActive ? "opacity-60" : ""}>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-lg">{r.label}</CardTitle>
                                        <CardDescription>
                                            {r.merchant || "No merchant"} • {TYPE_LABELS[r.type as keyof typeof TYPE_LABELS]}
                                        </CardDescription>
                                    </div>
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive
                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                            }`}
                                    >
                                        {r.isActive ? "Active" : "Paused"}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Amount</span>
                                        <span className="font-medium">${parseFloat(r.amount).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Tax Rate</span>
                                        <span>{(parseFloat(r.taxRate) * 100).toFixed(2)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Frequency</span>
                                        <span>{FREQUENCY_LABELS[r.frequency]}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Next Run</span>
                                        <span>{new Date(r.nextRunDate).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="mt-4 flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                                        Edit
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => toggleActive(r)}>
                                        {r.isActive ? "Pause" : "Resume"}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(r.id)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Recurring" : "Create Recurring"}</DialogTitle>
                        <DialogDescription>
                            Set up an automatic recurring transaction
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="label">Label</Label>
                            <Input
                                id="label"
                                placeholder="e.g., Monthly Insurance"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="merchant">Merchant</Label>
                                <Input
                                    id="merchant"
                                    placeholder="e.g., State Farm"
                                    value={merchant}
                                    onChange={(e) => setMerchant(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SALES_TAX">Sales Tax</SelectItem>
                                        <SelectItem value="INCOME_TAX">Income Tax</SelectItem>
                                        <SelectItem value="OTHER">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Total Amount ($)</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="100.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                                <Input
                                    id="taxRate"
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    max="100"
                                    placeholder="8.875"
                                    value={taxRate}
                                    onChange={(e) => setTaxRate(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="frequency">Frequency</Label>
                                <Select value={frequency} onValueChange={setFrequency}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                                        <SelectItem value="BIWEEKLY">Every 2 Weeks</SelectItem>
                                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {frequency === "MONTHLY" && (
                                <div className="space-y-2">
                                    <Label htmlFor="dayOfMonth">Day of Month (1-28)</Label>
                                    <Input
                                        id="dayOfMonth"
                                        type="number"
                                        min="1"
                                        max="28"
                                        placeholder="15"
                                        value={dayOfMonth}
                                        onChange={(e) => setDayOfMonth(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="nextRunDate">First/Next Run Date</Label>
                            <Input
                                id="nextRunDate"
                                type="date"
                                value={nextRunDate}
                                onChange={(e) => setNextRunDate(e.target.value)}
                                required
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? "Saving..." : editingId ? "Update" : "Create"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
