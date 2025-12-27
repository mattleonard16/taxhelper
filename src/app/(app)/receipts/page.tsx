"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceiptReviewDrawer, type InboxJob } from "@/components/receipts/receipt-review-drawer";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import type { ReceiptJobStatus } from "@prisma/client";

const STATUS_COLORS: Record<ReceiptJobStatus, string> = {
  QUEUED: "bg-gray-500",
  PROCESSING: "bg-blue-500",
  NEEDS_REVIEW: "bg-yellow-500",
  COMPLETED: "bg-green-500",
  CONFIRMED: "bg-emerald-600",
  FAILED: "bg-red-500",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "COMPLETED", label: "Ready to Confirm" },
  { value: "FAILED", label: "Failed" },
  { value: "CONFIRMED", label: "Confirmed" },
];

export default function ReceiptsInboxPage() {
  const [jobs, setJobs] = useState<InboxJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<InboxJob | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const response = await fetch(`/api/receipts/inbox?${params}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs);
      } else {
        toast.error("Failed to load receipts");
      }
    } catch (error) {
      console.error("Error fetching receipts:", error);
      toast.error("Failed to load receipts");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleRowClick = (job: InboxJob) => {
    setSelectedJob(job);
    setDrawerOpen(true);
  };

  const handleConfirmed = () => {
    fetchJobs();
  };

  const handleRetried = () => {
    fetchJobs();
  };

  const handleDeleted = () => {
    fetchJobs();
  };

  const pendingCount = jobs.filter(
    (j) => j.status === "NEEDS_REVIEW" || j.status === "COMPLETED"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receipt Inbox</h1>
          <p className="mt-1 text-muted-foreground">
            Review and confirm scanned receipts before creating transactions
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-sm">
            {pendingCount} pending review
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card/50 p-4 shadow-lg backdrop-blur">
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={fetchJobs} className="ml-auto">
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-lg">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground/50"
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
            <h3 className="mt-4 text-lg font-medium">No receipts found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload receipts from the dashboard to get started
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(job)}
                >
                  <TableCell>
                    <div className="max-w-[200px] truncate font-medium">
                      {job.originalName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={job.merchant ? "" : "text-muted-foreground italic"}>
                      {job.merchant || "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {job.date
                      ? new Date(job.date).toLocaleDateString()
                      : <span className="text-muted-foreground italic">Unknown</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {job.totalAmount
                      ? formatCurrency(parseFloat(job.totalAmount))
                      : <span className="text-muted-foreground italic">-</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[job.status]}>
                      {job.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {job.extractionConfidence !== null ? (
                      <span
                        className={
                          job.extractionConfidence >= 0.8
                            ? "text-green-500"
                            : job.extractionConfidence >= 0.6
                            ? "text-yellow-500"
                            : "text-red-500"
                        }
                      >
                        {Math.round(job.extractionConfidence * 100)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ReceiptReviewDrawer
        job={selectedJob}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onConfirmed={handleConfirmed}
        onRetried={handleRetried}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
