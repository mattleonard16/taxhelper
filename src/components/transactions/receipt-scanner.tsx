"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { createWorker, Worker } from "tesseract.js";

interface ExtractedData {
    merchant: string | null;
    total: number | null;
    tax: number | null;
    date: string | null;
}

interface ReceiptScannerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onExtract: (data: ExtractedData) => void;
}

export function ReceiptScanner({ open, onOpenChange, onExtract }: ReceiptScannerProps) {
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const workerRef = useRef<Worker | null>(null);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            setError("Please select an image file");
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (event) => {
            setPreview(event.target?.result as string);
        };
        reader.readAsDataURL(file);

        setScanning(true);
        setError(null);
        setProgress(0);

        try {
            // Create worker if not exists
            if (!workerRef.current) {
                workerRef.current = await createWorker("eng", 1, {
                    logger: (m) => {
                        if (m.status === "recognizing text") {
                            setProgress(Math.round(m.progress * 100));
                        }
                    },
                });
            }

            // Recognize text
            const { data } = await workerRef.current.recognize(file);
            const text = data.text;

            // Parse the extracted text
            const extracted = parseReceiptText(text);

            // Pass extracted data to parent
            onExtract(extracted);
            onOpenChange(false);
        } catch (err) {
            console.error("OCR error:", err);
            setError("Failed to scan receipt. Please try a clearer image.");
        } finally {
            setScanning(false);
            setProgress(0);
        }
    }, [onExtract, onOpenChange]);

    const handleClose = useCallback(() => {
        if (!scanning) {
            onOpenChange(false);
            setPreview(null);
            setError(null);
        }
    }, [scanning, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Scan Receipt</DialogTitle>
                    <DialogDescription>
                        Upload a photo of your receipt to auto-extract transaction details
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Upload Area */}
                    <div
                        className="relative rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50"
                        onClick={() => !scanning && fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={scanning}
                        />

                        {preview ? (
                            <div className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={preview}
                                    alt="Receipt preview"
                                    className="mx-auto max-h-48 rounded-lg object-contain"
                                />
                                {scanning && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            Scanning... {progress}%
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-4 text-center">
                                <svg
                                    className="mb-3 h-10 w-10 text-muted-foreground"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                <p className="text-sm font-medium">Click to upload receipt</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    or drag and drop an image
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}

                    {/* Info */}
                    <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                        <p className="font-medium">Tips for best results:</p>
                        <ul className="mt-1 list-inside list-disc space-y-0.5">
                            <li>Use good lighting</li>
                            <li>Keep the receipt flat</li>
                            <li>Capture the full receipt</li>
                            <li>Make sure text is readable</li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={handleClose} disabled={scanning}>
                            Cancel
                        </Button>
                        {preview && !scanning && (
                            <Button onClick={() => fileInputRef.current?.click()}>
                                Try Another
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Parse receipt text to extract merchant, total, tax, and date
 */
function parseReceiptText(text: string): ExtractedData {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    let merchant: string | null = null;
    let total: number | null = null;
    let tax: number | null = null;
    let date: string | null = null;

    // Common patterns for receipt parsing
    const totalPatterns = [
        /(?:total|amount|balance|grand total)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
        /\$\s*([\d,]+\.\d{2})\s*$/m,
    ];

    const taxPatterns = [
        /(?:tax|sales tax|vat|gst)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
        /(?:tax)\s+\$?\s*([\d,]+\.\d{2})/i,
    ];

    const datePatterns = [
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
        /([A-Za-z]{3,}\s+\d{1,2},?\s+\d{2,4})/,
    ];

    // Merchant is usually the first 1-2 lines
    // Skip lines that look like addresses or are too short
    for (const line of lines.slice(0, 5)) {
        if (
            line.length > 3 &&
            !line.match(/^\d{3,}/) && // Not a phone number
            !line.match(/[#]/i) && // Not a store number
            !line.match(/\d{5}/) && // Not a zip code
            !line.match(/^\$/) // Not a price
        ) {
            merchant = line;
            break;
        }
    }

    // Find total
    for (const pattern of totalPatterns) {
        const match = text.match(pattern);
        if (match) {
            total = parseFloat(match[1].replace(/,/g, ""));
            break;
        }
    }

    // Find tax
    for (const pattern of taxPatterns) {
        const match = text.match(pattern);
        if (match) {
            tax = parseFloat(match[1].replace(/,/g, ""));
            break;
        }
    }

    // Find date
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            try {
                const parsed = new Date(match[1]);
                if (!isNaN(parsed.getTime())) {
                    date = parsed.toISOString().split("T")[0];
                }
            } catch {
                // Invalid date, continue
            }
            break;
        }
    }

    return { merchant, total, tax, date };
}
