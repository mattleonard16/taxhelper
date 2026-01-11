import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CATEGORY_CODES } from "@/lib/categories";

const VALID_CATEGORY_CODES = CATEGORY_CODES;

const uniqueIds = z.array(z.string().min(1)).min(1).max(100).refine(
  (ids) => new Set(ids).size === ids.length,
  { message: "Duplicate IDs are not allowed" }
);

const batchUpdateSchema = z.object({
  ids: uniqueIds,
  updates: z.object({
    category: z.string().max(100).optional(),
    categoryCode: z.enum(VALID_CATEGORY_CODES).optional(),
    isDeductible: z.boolean().optional(),
    type: z.enum(["SALES_TAX", "INCOME_TAX", "OTHER"]).optional(),
  }).refine(
    (updates) => Object.keys(updates).length > 0,
    { message: "At least one update field is required" }
  ),
});

const batchDeleteSchema = z.object({
  ids: uniqueIds,
});

describe("batch transaction schemas", () => {
  describe("batchUpdateSchema", () => {
    it("accepts valid input with single ID", () => {
      const result = batchUpdateSchema.safeParse({
        ids: ["txn-1"],
        updates: { category: "Test" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid input with multiple IDs", () => {
      const result = batchUpdateSchema.safeParse({
        ids: ["txn-1", "txn-2", "txn-3"],
        updates: { isDeductible: true },
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid category codes", () => {
      for (const code of VALID_CATEGORY_CODES) {
        const result = batchUpdateSchema.safeParse({
          ids: ["txn-1"],
          updates: { categoryCode: code },
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects empty ID list", () => {
      const result = batchUpdateSchema.safeParse({
        ids: [],
        updates: { category: "Test" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects more than 100 IDs", () => {
      const ids = Array.from({ length: 101 }, (_, i) => `txn-${i}`);
      const result = batchUpdateSchema.safeParse({
        ids,
        updates: { category: "Test" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects duplicate IDs", () => {
      const result = batchUpdateSchema.safeParse({
        ids: ["txn-1", "txn-2", "txn-1"],
        updates: { category: "Test" },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Duplicate");
      }
    });

    it("rejects empty string IDs", () => {
      const result = batchUpdateSchema.safeParse({
        ids: ["txn-1", ""],
        updates: { category: "Test" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid category code", () => {
      const result = batchUpdateSchema.safeParse({
        ids: ["txn-1"],
        updates: { categoryCode: "INVALID_CODE" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty updates object", () => {
      const result = batchUpdateSchema.safeParse({
        ids: ["txn-1"],
        updates: {},
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("At least one update");
      }
    });

    it("rejects invalid type", () => {
      const result = batchUpdateSchema.safeParse({
        ids: ["txn-1"],
        updates: { type: "INVALID_TYPE" },
      });
      expect(result.success).toBe(false);
    });

    it("accepts multiple update fields", () => {
      const result = batchUpdateSchema.safeParse({
        ids: ["txn-1", "txn-2"],
        updates: {
          category: "Meals & Entertainment",
          categoryCode: "MEALS",
          isDeductible: true,
          type: "SALES_TAX",
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("batchDeleteSchema", () => {
    it("accepts valid input", () => {
      const result = batchDeleteSchema.safeParse({
        ids: ["txn-1", "txn-2"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty ID list", () => {
      const result = batchDeleteSchema.safeParse({
        ids: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects more than 100 IDs", () => {
      const ids = Array.from({ length: 101 }, (_, i) => `txn-${i}`);
      const result = batchDeleteSchema.safeParse({ ids });
      expect(result.success).toBe(false);
    });

    it("rejects duplicate IDs", () => {
      const result = batchDeleteSchema.safeParse({
        ids: ["txn-1", "txn-1"],
      });
      expect(result.success).toBe(false);
    });
  });
});
