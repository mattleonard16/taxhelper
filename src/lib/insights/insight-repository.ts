import { prisma } from "@/lib/prisma";
import type { Insight } from "./types";
import type { Insight as PrismaInsight, InsightRun as PrismaInsightRun } from "@prisma/client";

export type StoredInsight = Insight & {
  id: string;
  dismissed: boolean;
  pinned: boolean;
};

export type InsightRunRecord = {
  id: string;
  userId: string;
  range: number;
  generatedAt: Date;
  insights: StoredInsight[];
};

export type InsightRepository = {
  findLatestRun: (userId: string, range: number) => Promise<InsightRunRecord | null>;
  createRun: (userId: string, range: number, insights: Insight[]) => Promise<InsightRunRecord>;
  updateInsightState: (
    userId: string,
    id: string,
    updates: { dismissed?: boolean; pinned?: boolean }
  ) => Promise<StoredInsight | null>;
};

const mapInsight = (record: PrismaInsight): StoredInsight => ({
  id: record.id,
  type: record.type,
  title: record.title,
  summary: record.summary,
  severityScore: record.severityScore,
  supportingTransactionIds: record.supportingTransactionIds ?? [],
  dismissed: record.dismissed,
  pinned: record.pinned,
});

const mapRun = (
  record: PrismaInsightRun & { insights: PrismaInsight[] }
): InsightRunRecord => ({
  id: record.id,
  userId: record.userId,
  range: record.range,
  generatedAt: record.generatedAt,
  insights: record.insights.map(mapInsight),
});

export const createInsightRepository = (client = prisma): InsightRepository => ({
  findLatestRun: async (userId, range) => {
    const run = await client.insightRun.findFirst({
      where: { userId, range },
      orderBy: { generatedAt: "desc" },
      include: { insights: true },
    });

    if (!run) return null;
    return mapRun(run);
  },
  createRun: async (userId, range, insights) => {
    const created = await client.insightRun.create({
      data: {
        userId,
        range,
        insights: {
          create: insights.map((insight) => ({
            type: insight.type,
            title: insight.title,
            summary: insight.summary,
            severityScore: Math.round(insight.severityScore),
            supportingTransactionIds: insight.supportingTransactionIds,
            dismissed: insight.dismissed ?? false,
            pinned: insight.pinned ?? false,
          })),
        },
      },
      include: { insights: true },
    });

    return mapRun(created);
  },
  updateInsightState: async (userId, id, updates) => {
    const existing = await client.insight.findFirst({
      where: { id, run: { userId } },
    });

    if (!existing) return null;

    const updated = await client.insight.update({
      where: { id },
      data: {
        ...(updates.dismissed !== undefined && { dismissed: updates.dismissed }),
        ...(updates.pinned !== undefined && { pinned: updates.pinned }),
      },
    });

    return mapInsight(updated);
  },
});
