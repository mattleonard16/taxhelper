"use client";

import { useState } from "react";
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
import { toast } from "sonner";

export default function ReportsPage() {
    const [loading, setLoading] = useState(false);

    // Date range defaults to current year
    const currentYear = new Date().getFullYear();
    const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
    const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);

    const [format, setFormat] = useState<"pdf" | "csv">("pdf");
    const [groupBy, setGroupBy] = useState<"month" | "type" | "merchant">("month");

    const handleDownload = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                from: fromDate,
                to: toDate,
                format,
                groupBy,
            });

            const response = await fetch(`/api/reports?${params}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to generate report");
            }

            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get("Content-Disposition");
            const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
            const filename = filenameMatch?.[1] || `tax-report.${format}`;

            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success(`Report downloaded: ${filename}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Something went wrong";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    // Quick date range presets
    const setQuickRange = (preset: "ytd" | "q1" | "q2" | "q3" | "q4" | "lastYear") => {
        const year = preset === "lastYear" ? currentYear - 1 : currentYear;

        switch (preset) {
            case "ytd":
                setFromDate(`${currentYear}-01-01`);
                setToDate(new Date().toISOString().split("T")[0]);
                break;
            case "q1":
                setFromDate(`${year}-01-01`);
                setToDate(`${year}-03-31`);
                break;
            case "q2":
                setFromDate(`${year}-04-01`);
                setToDate(`${year}-06-30`);
                break;
            case "q3":
                setFromDate(`${year}-07-01`);
                setToDate(`${year}-09-30`);
                break;
            case "q4":
                setFromDate(`${year}-10-01`);
                setToDate(`${year}-12-31`);
                break;
            case "lastYear":
                setFromDate(`${year}-01-01`);
                setToDate(`${year}-12-31`);
                break;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Tax Reports</h1>
                <p className="mt-1 text-muted-foreground">
                    Generate downloadable reports for tax filing and record keeping
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Report Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle>Generate Report</CardTitle>
                        <CardDescription>
                            Select date range and format for your tax report
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Quick Range Buttons */}
                        <div className="space-y-2">
                            <Label>Quick Select</Label>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setQuickRange("ytd")}
                                >
                                    Year to Date
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setQuickRange("lastYear")}
                                >
                                    Last Year
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setQuickRange("q1")}
                                >
                                    Q1
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setQuickRange("q2")}
                                >
                                    Q2
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setQuickRange("q3")}
                                >
                                    Q3
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setQuickRange("q4")}
                                >
                                    Q4
                                </Button>
                            </div>
                        </div>

                        {/* Date Range */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="fromDate">From Date</Label>
                                <Input
                                    id="fromDate"
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="toDate">To Date</Label>
                                <Input
                                    id="toDate"
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Format Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="format">Format</Label>
                            <Select value={format} onValueChange={(v) => setFormat(v as "pdf" | "csv")}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pdf">
                                        PDF - Professional formatted report
                                    </SelectItem>
                                    <SelectItem value="csv">
                                        CSV - Spreadsheet compatible
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Group By Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="groupBy">Group Summary By</Label>
                            <Select
                                value={groupBy}
                                onValueChange={(v) => setGroupBy(v as "month" | "type" | "merchant")}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="month">Month</SelectItem>
                                    <SelectItem value="type">Tax Type</SelectItem>
                                    <SelectItem value="merchant">Merchant</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Transactions will be summarized in tables grouped by this field
                            </p>
                        </div>

                        {/* Download Button */}
                        <div className="pt-4">
                            <Button
                                onClick={handleDownload}
                                disabled={loading || !fromDate || !toDate}
                                className="w-full"
                            >
                                {loading ? (
                                    <>
                                        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
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
                                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                            />
                                        </svg>
                                        Download {format.toUpperCase()} Report
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Report Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Report Contents</CardTitle>
                        <CardDescription>
                            What&apos;s included in your tax report
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                                <svg className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span><strong className="text-foreground">Summary totals</strong> — Total tax paid, total spent, and transaction count</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span><strong className="text-foreground">Grouped breakdown</strong> — Summary table grouped by your selection (month, type, or merchant)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span><strong className="text-foreground">Transaction details</strong> — Complete list of all transactions in the date range</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <svg className="mt-0.5 h-4 w-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span><strong className="text-foreground">Tax categories</strong> — Sales tax, income tax, and other tax types clearly labeled</span>
                            </li>
                        </ul>

                        <div className="mt-6 rounded-lg bg-muted/50 p-4">
                            <h4 className="font-medium">💡 Tip</h4>
                            <p className="mt-1 text-sm text-muted-foreground">
                                For tax filing, generate a &quot;Year to Date&quot; or full year report grouped by &quot;Month&quot; to see your tax burden over time.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
