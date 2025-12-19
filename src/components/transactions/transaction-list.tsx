"use client";

import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Transaction } from "@/types";
import { TYPE_LABELS_SHORT, TYPE_COLORS } from "@/lib/constants";

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

const VIRTUALIZATION_THRESHOLD = 50;
const VIRTUAL_ROW_HEIGHT = 56;
const VIRTUAL_OVERSCAN = 8;
const VIRTUAL_VIEWPORT_HEIGHT = 560;
const VIRTUAL_GRID_TEMPLATE =
  "grid-cols-[140px_110px_minmax(140px,1fr)_minmax(160px,1.2fr)_120px_110px_90px_120px]";
const VIRTUAL_CELL_BASE = "px-3 py-2 whitespace-nowrap md:px-2";

function calculateTaxRate(taxAmount: string, totalAmount: string): string {
  const tax = parseFloat(taxAmount);
  const total = parseFloat(totalAmount);
  const preTax = total - tax;
  if (preTax <= 0) return "—";
  const rate = (tax / preTax) * 100;
  return `${rate.toFixed(1)}%`;
}

function TransactionActions({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex justify-end gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Edit"
        onClick={() => onEdit(transaction)}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive md:hidden"
        aria-label="Delete"
        onClick={() => onDelete(transaction.id)}
      >
        <Trash2 className="size-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="hidden md:inline-flex"
        onClick={() => onEdit(transaction)}
      >
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="hidden text-destructive hover:text-destructive md:inline-flex"
        onClick={() => onDelete(transaction.id)}
      >
        Delete
      </Button>
    </div>
  );
}

function VirtualizedTransactionTable({
  transactions,
  onEdit,
  onDelete,
}: TransactionListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => VIRTUAL_ROW_HEIGHT,
    overscan: VIRTUAL_OVERSCAN,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const viewportHeight = Math.min(
    transactions.length * VIRTUAL_ROW_HEIGHT,
    VIRTUAL_VIEWPORT_HEIGHT
  );

  return (
    <div className="rounded-xl border border-border bg-card/50 shadow-lg backdrop-blur">
      <div className="overflow-x-auto">
        <div role="table" className="min-w-[860px] text-sm">
          <div
            role="row"
            className={`grid ${VIRTUAL_GRID_TEMPLATE} items-center border-b bg-card/40 text-foreground`}
          >
            <div role="columnheader" className={VIRTUAL_CELL_BASE}>
              Date
            </div>
            <div role="columnheader" className={VIRTUAL_CELL_BASE}>
              Type
            </div>
            <div role="columnheader" className={VIRTUAL_CELL_BASE}>
              Merchant
            </div>
            <div role="columnheader" className={VIRTUAL_CELL_BASE}>
              Description
            </div>
            <div
              role="columnheader"
              className={`${VIRTUAL_CELL_BASE} text-right`}
            >
              Total
            </div>
            <div
              role="columnheader"
              className={`${VIRTUAL_CELL_BASE} text-right`}
            >
              Tax
            </div>
            <div
              role="columnheader"
              className={`${VIRTUAL_CELL_BASE} text-right`}
            >
              Rate
            </div>
            <div role="columnheader" className={VIRTUAL_CELL_BASE} />
          </div>

          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ height: viewportHeight }}
          >
            <div className="relative" style={{ height: totalSize }}>
              {virtualRows.map((virtualRow) => {
                const transaction = transactions[virtualRow.index];
                return (
                  <div
                    key={transaction.id}
                    role="row"
                    className={`group grid ${VIRTUAL_GRID_TEMPLATE} items-center border-b transition-colors hover:bg-muted/50`}
                    style={{
                      position: "absolute",
                      top: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: "100%",
                    }}
                  >
                    <div role="cell" className={`${VIRTUAL_CELL_BASE} font-medium`}>
                      {formatDate(transaction.date)}
                    </div>
                    <div role="cell" className={VIRTUAL_CELL_BASE}>
                      <Badge
                        variant="outline"
                        className={cn("border", TYPE_COLORS[transaction.type])}
                      >
                        {TYPE_LABELS_SHORT[transaction.type] || transaction.type}
                      </Badge>
                    </div>
                    <div role="cell" className={VIRTUAL_CELL_BASE}>
                      {transaction.merchant || "—"}
                    </div>
                    <div
                      role="cell"
                      className={`${VIRTUAL_CELL_BASE} max-w-[220px] truncate text-muted-foreground`}
                    >
                      {transaction.description || "—"}
                    </div>
                    <div
                      role="cell"
                      className={`${VIRTUAL_CELL_BASE} text-right font-medium`}
                    >
                      {formatCurrency(transaction.totalAmount, transaction.currency)}
                    </div>
                    <div
                      role="cell"
                      className={`${VIRTUAL_CELL_BASE} text-right font-semibold text-chart-1`}
                    >
                      {formatCurrency(transaction.taxAmount, transaction.currency)}
                    </div>
                    <div
                      role="cell"
                      className={`${VIRTUAL_CELL_BASE} text-right text-sm font-medium text-amber-600 dark:text-amber-400`}
                    >
                      {calculateTaxRate(
                        transaction.taxAmount,
                        transaction.totalAmount
                      )}
                    </div>
                    <div role="cell" className={VIRTUAL_CELL_BASE}>
                      <TransactionActions
                        transaction={transaction}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const TransactionList = React.memo(function TransactionList({
  transactions,
  onEdit,
  onDelete,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 py-16">
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
              d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold">No transactions found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your filters or add a new transaction to start tracking.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Tip: use the Add Transaction button or press "N" to create one faster.
        </p>
      </div>
    );
  }

  if (transactions.length > VIRTUALIZATION_THRESHOLD) {
    return (
      <VirtualizedTransactionTable
        transactions={transactions}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 shadow-lg backdrop-blur">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Tax</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id} className="group">
              <TableCell className="font-medium">
                {formatDate(transaction.date)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn("border", TYPE_COLORS[transaction.type])}
                >
                  {TYPE_LABELS_SHORT[transaction.type] || transaction.type}
                </Badge>
              </TableCell>
              <TableCell>{transaction.merchant || "—"}</TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground">
                {transaction.description || "—"}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(transaction.totalAmount, transaction.currency)}
              </TableCell>
              <TableCell className="text-right font-semibold text-chart-1">
                {formatCurrency(transaction.taxAmount, transaction.currency)}
              </TableCell>
              <TableCell className="text-right text-sm font-medium text-amber-600 dark:text-amber-400">
                {calculateTaxRate(transaction.taxAmount, transaction.totalAmount)}
              </TableCell>
              <TableCell>
                <TransactionActions
                  transaction={transaction}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});
