import { parseDateInput } from "@/lib/date-utils";
import type { TransactionQueryInput } from "@/lib/schemas";
import type { Prisma } from "@prisma/client";

type TransactionSearchFilters = Pick<
  TransactionQueryInput,
  "from" | "to" | "type" | "search" | "minAmount" | "maxAmount" | "category" | "isDeductible"
>;

export const buildTransactionDateRange = (
  from?: string,
  to?: string
): { gte?: Date; lte?: Date } | undefined => {
  const dateFilter: { gte?: Date; lte?: Date } = {};

  if (from) dateFilter.gte = parseDateInput(from, "start");
  if (to) dateFilter.lte = parseDateInput(to, "end");

  return Object.keys(dateFilter).length > 0 ? dateFilter : undefined;
};

export const buildTransactionSearchWhere = (
  userId: string,
  filters: TransactionSearchFilters
): Prisma.TransactionWhereInput => {
  const where: Prisma.TransactionWhereInput = { userId };

  const dateFilter = buildTransactionDateRange(filters.from, filters.to);
  if (dateFilter) {
    where.date = dateFilter;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.totalAmount = {
      ...(filters.minAmount !== undefined ? { gte: filters.minAmount } : {}),
      ...(filters.maxAmount !== undefined ? { lte: filters.maxAmount } : {}),
    };
  }

  if (filters.search) {
    where.OR = [
      { merchant: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.category) {
    where.categoryCode = filters.category;
  }

  if (filters.isDeductible !== undefined) {
    where.isDeductible = filters.isDeductible;
  }

  return where;
};
