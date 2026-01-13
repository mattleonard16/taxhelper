import { describe, expect, it } from "vitest";
import { transactionQuerySchema } from "@/lib/schemas";
import { parseDateInput } from "@/lib/date-utils";
import { buildTransactionSearchWhere } from "@/lib/transactions/transaction-search";

const types = ["SALES_TAX", "INCOME_TAX", "OTHER"] as const;
const dateRanges = ["7d", "30d", "90d"] as const;
const minAmounts = [0, 50, 100] as const;
const maxAmounts = [100, 500, "unlimited"] as const;
const categories = [undefined, "MEALS", "TRAVEL"] as const;
const deductibles = [undefined, true, false] as const;

type CaseTuple = [
  typeof types[number],
  typeof dateRanges[number],
  typeof minAmounts[number],
  typeof maxAmounts[number],
  typeof categories[number],
  typeof deductibles[number]
];

const rangeToDays: Record<(typeof dateRanges)[number], number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const baseDate = new Date("2024-06-30T12:00:00");

const toDateString = (date: Date) => date.toISOString().split("T")[0];

const getRangeDates = (range: (typeof dateRanges)[number]) => {
  const end = new Date(baseDate);
  const start = new Date(baseDate);
  start.setDate(start.getDate() - rangeToDays[range]);
  return { from: toDateString(start), to: toDateString(end) };
};

const cartesianProduct = <T,>(lists: T[][]): T[][] => {
  return lists.reduce<T[][]>(
    (acc, list) => acc.flatMap((prev) => list.map((value) => [...prev, value])),
    [[]]
  );
};

const buildPairKey = (i: number, j: number, a: unknown, b: unknown) =>
  `${i}:${String(a)}|${j}:${String(b)}`;

const buildAllPairs = (values: unknown[][]) => {
  const pairs = new Set<string>();
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      for (const a of values[i]) {
        for (const b of values[j]) {
          pairs.add(buildPairKey(i, j, a, b));
        }
      }
    }
  }
  return pairs;
};

const getCasePairs = (caseValues: unknown[]) => {
  const pairs: string[] = [];
  for (let i = 0; i < caseValues.length; i += 1) {
    for (let j = i + 1; j < caseValues.length; j += 1) {
      pairs.push(buildPairKey(i, j, caseValues[i], caseValues[j]));
    }
  }
  return pairs;
};

const generatePairwiseCases = (): CaseTuple[] => {
  const values = [types, dateRanges, minAmounts, maxAmounts, categories, deductibles].map(
    (list) => Array.from(list as readonly unknown[])
  );
  const allCases = cartesianProduct(values) as CaseTuple[];
  const uncovered = buildAllPairs(values);
  const selected: CaseTuple[] = [];

  const remaining = [...allCases];

  while (uncovered.size > 0 && remaining.length > 0) {
    let bestIndex = 0;
    let bestCoverage = -1;

    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const coverage = getCasePairs(candidate).filter((pair) =>
        uncovered.has(pair)
      ).length;

      if (coverage > bestCoverage) {
        bestCoverage = coverage;
        bestIndex = i;
      }
    }

    const [chosen] = remaining.splice(bestIndex, 1);
    selected.push(chosen);
    for (const pair of getCasePairs(chosen)) {
      uncovered.delete(pair);
    }
  }

  return selected;
};

const pairwiseCases = generatePairwiseCases();

describe("transaction search pairwise coverage", () => {
  it("covers all parameter pairs", () => {
    const values = [types, dateRanges, minAmounts, maxAmounts, categories, deductibles].map(
      (list) => Array.from(list as readonly unknown[])
    );
    const allPairs = buildAllPairs(values);
    const covered = new Set<string>();

    for (const testCase of pairwiseCases) {
      for (const pair of getCasePairs(testCase)) {
        covered.add(pair);
      }
    }

    expect(covered.size).toBe(allPairs.size);
  });

  it.each(pairwiseCases)(
    "builds where clause for %s %s min=%s max=%s cat=%s deduct=%s",
    (type, dateRange, minAmount, maxAmount, category, isDeductible) => {
      const { from, to } = getRangeDates(dateRange);
      const params: Record<string, string> = {
        type,
        from,
        to,
        minAmount: String(minAmount),
      };

      if (maxAmount !== "unlimited") {
        params.maxAmount = String(maxAmount);
      }
      if (category !== undefined) {
        params.category = category;
      }
      if (isDeductible !== undefined) {
        params.isDeductible = String(isDeductible);
      }

      const parsed = transactionQuerySchema.parse(params);
      const where = buildTransactionSearchWhere("user_1", parsed);
      const dateFilter = where.date as { gte?: Date; lte?: Date } | undefined;
      const amountFilter = where.totalAmount as { gte?: number; lte?: number } | undefined;

      expect(where.userId).toBe("user_1");
      expect(where.type).toBe(type);
      expect(dateFilter?.gte).toEqual(parseDateInput(from, "start"));
      expect(dateFilter?.lte).toEqual(parseDateInput(to, "end"));

      if (maxAmount === "unlimited") {
        expect(amountFilter?.lte).toBeUndefined();
      } else {
        expect(amountFilter?.lte).toBe(maxAmount);
      }

      expect(amountFilter?.gte).toBe(minAmount);

      if (category !== undefined) {
        expect(where.categoryCode).toBe(category);
      } else {
        expect(where.categoryCode).toBeUndefined();
      }

      if (isDeductible !== undefined) {
        expect(where.isDeductible).toBe(isDeductible);
      } else {
        expect(where.isDeductible).toBeUndefined();
      }
    }
  );

  it("adds priority filter when provided", () => {
    const parsed = transactionQuerySchema.parse({
      priority: "HIGH",
    });

    const where = buildTransactionSearchWhere("user_1", parsed);
    expect(where.priority).toBe("HIGH");
  });
});
