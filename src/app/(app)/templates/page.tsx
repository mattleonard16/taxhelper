"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Template } from "@/types";
import { TYPE_LABELS } from "@/lib/constants";
import { TemplateCardsSkeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [label, setLabel] = useState("");
  const [merchant, setMerchant] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [type, setType] = useState("SALES_TAX");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    n: () => {
      if (!formOpen) {
        resetForm();
        setFormOpen(true);
      }
    },
    Escape: () => {
      if (deleteDialogOpen) {
        setDeleteDialogOpen(false);
      } else if (formOpen) {
        setFormOpen(false);
      }
    },
  });

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = () => {
    setLabel("");
    setMerchant("");
    setTaxRate("");
    setType("SALES_TAX");
    setIsDefault(false);
    setEditingTemplate(null);
    setError(null);
  };

  const openForm = (template?: Template) => {
    setError(null);
    if (template) {
      setEditingTemplate(template);
      setLabel(template.label);
      setMerchant(template.merchant || "");
      setTaxRate((parseFloat(template.taxRate) * 100).toString());
      setType(template.type);
      setIsDefault(template.isDefault);
    } else {
      resetForm();
    }
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingTemplate
        ? `/api/templates/${editingTemplate.id}`
        : "/api/templates";
      const method = editingTemplate ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          merchant: merchant || null,
          taxRate: parseFloat(taxRate) / 100,
          type,
          isDefault,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save template");
      }

      toast.success(editingTemplate ? "Template updated" : "Template created");
      setFormOpen(false);
      resetForm();
      fetchTemplates();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      const response = await fetch(`/api/templates/${deletingId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Template deleted");
        fetchTemplates();
      } else {
        toast.error("Failed to delete template");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tax Templates</h1>
            <p className="mt-1 text-muted-foreground">
              Create templates for common merchants and default tax rates
            </p>
          </div>
        </div>
        <TemplateCardsSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax Templates</h1>
          <p className="mt-1 text-muted-foreground">
            Create templates for common merchants and default tax rates
          </p>
        </div>
        <Button
          size="lg"
          className="bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25"
          onClick={() => openForm()}
        >
          <svg
            className="mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 rounded-full bg-secondary p-4">
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">No templates yet</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Create templates to quickly apply tax rates when adding transactions.
            </p>
            <Button className="mt-4" onClick={() => openForm()}>
              Create your first template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={cn(
                "group relative overflow-hidden border-0 bg-card/50 shadow-lg backdrop-blur transition-all hover:shadow-xl",
                template.isDefault && "ring-2 ring-primary"
              )}
            >
              {template.isDefault && (
                <div className="absolute right-0 top-0 rounded-bl-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                  Default
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{template.label}</CardTitle>
                <CardDescription>
                  {template.merchant || "Any merchant"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-2xl font-bold">
                      {(parseFloat(template.taxRate) * 100).toFixed(3)}%
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[template.type] || template.type}
                    </Badge>
	                  </div>
	                  <div className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
	                    <Button
	                      variant="ghost"
	                      size="sm"
	                      onClick={() => openForm(template)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteClick(template.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </SheetTitle>
            <SheetDescription>
              Templates help you quickly apply tax rates when adding transactions.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                placeholder="e.g., NYC Sales Tax, Amazon"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant (optional)</Label>
              <Input
                id="merchant"
                placeholder="e.g., Target, Amazon"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for a general tax rate template
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <div className="relative">
                <Input
                  id="taxRate"
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  placeholder="8.875"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="pr-8"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="isDefault" className="font-normal">
                Set as default template
              </Label>
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
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving..." : editingTemplate ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete template?"
        description="This action cannot be undone. This will permanently delete the template."
      />
    </div>
  );
}
