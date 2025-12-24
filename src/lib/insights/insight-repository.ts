import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { Insight, InsightExplanation } from "./types";
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

const isNumberOrString = (value: unknown): value is number | string =>
  typeof value === "number" || typeof value === "string";

const isThresholdEntry = (
  value: unknown
): value is { name: string; actual: number | string; threshold: number | string } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    isNumberOrString(obj.actual) &&
    isNumberOrString(obj.threshold)
  );
};

const parseExplanation = (value: Prisma.JsonValue | null): InsightExplanation | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const obj = value as Record<string, unknown>;
  if (typeof obj.reason !== "string") {
    return undefined;
  }

  const thresholds = Array.isArray(obj.thresholds) ? obj.thresholds : [];
  const parsedThresholds = thresholds.filter(isThresholdEntry).map((threshold) => ({
    name: threshold.name,
    actual: threshold.actual,
    threshold: threshold.threshold,
  }));

  const explanation: InsightExplanation = {
    reason: obj.reason,
    thresholds: parsedThresholds,
  };

  if (typeof obj.suggestion === "string") {
    explanation.suggestion = obj.suggestion;
  }

  return explanation;
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
  explanation: parseExplanation(record.explanation),
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
            explanation: insight.explanation
              ? (insight.explanation as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
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
