import { prisma } from "@/lib/prisma";
import type { Transaction } from "@/types";
import type { Prisma } from "@prisma/client";

const transactionSelect = {
  id: true,
  date: true,
  type: true,
  description: true,
  merchant: true,
  totalAmount: true,
  taxAmount: true,
  currency: true,
} satisfies Prisma.TransactionSelect;

type TransactionSelectResult = Prisma.TransactionGetPayload<{
  select: typeof transactionSelect;
}>;

export type TransactionRepository = {
  listByUserSince: (userId: string, fromDate: Date) => Promise<Transaction[]>;
  getLatestUpdatedAt: (userId: string) => Promise<Date | null>;
};

const mapTransaction = (transaction: TransactionSelectResult): Transaction => ({
  id: transaction.id,
  date: transaction.date.toISOString(),
  type: transaction.type,
  description: transaction.description,
  merchant: transaction.merchant,
  totalAmount: transaction.totalAmount.toString(),
  taxAmount: transaction.taxAmount.toString(),
  currency: transaction.currency,
});

export const createTransactionRepository = (
  client = prisma
): TransactionRepository => ({
  listByUserSince: async (userId, fromDate) => {
    const rawTransactions = await client.transaction.findMany({
      where: {
        userId,
        date: { gte: fromDate },
      },
      orderBy: { date: "desc" },
      select: transactionSelect,
    });

    return rawTransactions.map(mapTransaction);
  },
  getLatestUpdatedAt: async (userId) => {
    const result = await client.transaction.aggregate({
      where: { userId },
      _max: { updatedAt: true },
    });

    return result._max.updatedAt ?? null;
  },
});
