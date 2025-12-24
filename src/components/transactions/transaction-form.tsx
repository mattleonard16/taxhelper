"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { Template } from "@/types";
import { ReceiptScanner } from "./receipt-scanner";

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  transaction?: {
    id: string;
    date: string;
    type: string;
    description: string | null;
    merchant: string | null;
    totalAmount: string;
    taxAmount: string;
  } | null;
}

export function TransactionForm({
  open,
  onOpenChange,
  onSuccess,
  transaction,
}: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("SALES_TAX");
  const [date, setDate] = useState("");
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [useRate, setUseRate] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const isEditing = !!transaction;

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch {
      // Silently fail - templates are optional
    }
  }, []);

  // Fetch user's default tax rate
  const fetchDefaultTaxRate = useCallback(async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        if (data.defaultTaxRate) {
          // Convert decimal (0.08875) to percentage (8.875)
          const ratePercent = (parseFloat(data.defaultTaxRate) * 100).toFixed(3);
          setTaxRate(ratePercent);
          setUseRate(true);
        }
      }
    } catch {
      // Silently fail - settings are optional
    }
  }, []);

  useEffect(() => {
    if (open && !isEditing) {
      fetchTemplates();
      fetchDefaultTaxRate();
    }
  }, [open, isEditing, fetchTemplates, fetchDefaultTaxRate]);

  const applyTemplate = useCallback((templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setType(template.type);
      setMerchant(template.merchant || "");
      // Convert tax rate from decimal (0.08875) to percentage (8.875)
      const ratePercent = (parseFloat(template.taxRate) * 100).toFixed(3);
      setTaxRate(ratePercent);
      // Only enable rate mode for SALES_TAX - other types hide the rate UI
      setUseRate(template.type === "SALES_TAX");
      // For non-SALES_TAX, pre-calculate tax amount so field isn't empty
      if (template.type !== "SALES_TAX" && totalAmount) {
        const total = parseFloat(totalAmount);
        const rate = parseFloat(ratePercent) / 100;
        if (!isNaN(total) && !isNaN(rate)) {
          // Use pre-tax calculation: preTax = total / (1 + rate), tax = preTax * rate
          const preTax = total / (1 + rate);
          setTaxAmount((preTax * rate).toFixed(2));
        }
      }
      setSelectedTemplateId(templateId);
    }
  }, [templates, totalAmount]);

  // Handle receipt scan results
  const handleReceiptExtract = useCallback((data: {
    merchant: string | null;
    total: number | null;
    tax: number | null;
    date: string | null;
  }) => {
    if (data.merchant) setMerchant(data.merchant);
    if (data.total) setTotalAmount(data.total.toFixed(2));
    if (data.tax) setTaxAmount(data.tax.toFixed(2));
    if (data.date) setDate(data.date);
    toast.success("Receipt scanned! Review the extracted data.");
  }, []);

  useEffect(() => {
    setError(null);
    setSelectedTemplateId("");
    if (transaction) {
      setType(transaction.type);
      setDate(transaction.date.split("T")[0]);
      setMerchant(transaction.merchant || "");
      setDescription(transaction.description || "");
      setTotalAmount(transaction.totalAmount);
      setTaxAmount(transaction.taxAmount);
      setTaxRate("");
      setUseRate(false);
    } else {
      setType("SALES_TAX");
      setDate(new Date().toISOString().split("T")[0]);
      setMerchant("");
      setDescription("");
      setTotalAmount("");
      setTaxAmount("");
      setTaxRate("");
      setUseRate(false);
    }
  }, [transaction, open]);

  useEffect(() => {
    if (useRate && totalAmount && taxRate) {
      const total = parseFloat(totalAmount);
      const rate = parseFloat(taxRate) / 100;
      if (!isNaN(total) && !isNaN(rate)) {
        // Pre-tax calculation: if total is $108.625 and rate is 8.625%,
        // preTax = 108.625 / 1.08625 = 100, tax = 100 * 0.08625 = 8.625
        const preTax = total / (1 + rate);
        setTaxAmount((preTax * rate).toFixed(2));
      }
    }
  }, [totalAmount, taxRate, useRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = isEditing ? `/api/transactions/${transaction.id}` : "/api/transactions";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          type,
          description: description || null,
          merchant: merchant || null,
          totalAmount: parseFloat(totalAmount),
          taxAmount: parseFloat(taxAmount),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save transaction");
      }

      toast.success(isEditing ? "Transaction updated" : "Transaction added");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isEditing ? "Edit Transaction" : "Add Transaction"}</SheetTitle>
            <SheetDescription>
              {type === "INCOME_TAX"
                ? "Log tax withheld from a paycheck"
                : "Log tax paid on a purchase"}
            </SheetDescription>
          </SheetHeader>

          {/* Scan Receipt button - only show when creating */}
          {!isEditing && (
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setScannerOpen(true)}
              >
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Scan Receipt
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Template selector - only show when creating new transaction */}
            {!isEditing && templates.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="template">Use Template (optional)</Label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={(value) => {
                    if (value === "none") {
                      setSelectedTemplateId("");
                    } else {
                      applyTemplate(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No template</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.label}
                        {template.isDefault && " (default)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Auto-fill type, merchant, and tax rate from a saved template
                </p>
              </div>
            )}

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

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant">
                {type === "INCOME_TAX" ? "Employer" : "Merchant"}
              </Label>
              <Input
                id="merchant"
                placeholder={type === "INCOME_TAX" ? "e.g., Acme Corp" : "e.g., Target"}
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="e.g., Groceries, Weekly paycheck"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount">
                {type === "INCOME_TAX" ? "Gross Pay" : "Total Amount"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="totalAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="pl-7"
                  required
                />
              </div>
            </div>

            {type === "SALES_TAX" && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={useRate ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setUseRate(!useRate)}
                >
                  {useRate ? "Using rate" : "Use tax rate"}
                </Button>
                {useRate && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      max="100"
                      placeholder="8.875"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="taxAmount">
                {type === "INCOME_TAX" ? "Tax Withheld" : "Tax Amount"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="taxAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  className="pl-7"
                  required
                  disabled={useRate && !!taxRate && type === "SALES_TAX"}
                />
              </div>
            </div>

            {error && (
              <div role="alert" aria-live="polite" className="text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Saving..." : isEditing ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Receipt Scanner Dialog */}
      <ReceiptScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onExtract={handleReceiptExtract}
        transactionType={type as "SALES_TAX" | "INCOME_TAX" | "OTHER"}
      />
    </>
  );
}
