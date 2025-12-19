import { prisma } from "@/lib/prisma";
import type { Transaction } from "@/types";
import type { Transaction as PrismaTransaction } from "@prisma/client";

export type TransactionRepository = {
  listByUserSince: (userId: string, fromDate: Date) => Promise<Transaction[]>;
  getLatestUpdatedAt: (userId: string) => Promise<Date | null>;
};

const mapTransaction = (transaction: PrismaTransaction): Transaction => ({
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
      select: {
        id: true,
        date: true,
        type: true,
        description: true,
        merchant: true,
        totalAmount: true,
        taxAmount: true,
        currency: true,
      },
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
