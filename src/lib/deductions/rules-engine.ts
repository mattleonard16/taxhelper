import type { Transaction } from "@/types";
import { DEDUCTION_RULES } from "./rules";
import type { DeductionContext, DeductionMatch, DeductionRule } from "./types";

const DEFAULT_MIN_CONFIDENCE = 0.45;

export type MatchOptions = {
  minConfidence?: number;
};

export function matchDeductionRules(
  transaction: Transaction,
  context: DeductionContext = {},
  options: MatchOptions = {}
): DeductionMatch[] {
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const merchant = (transaction.merchant ?? "").toLowerCase();
  const description = (transaction.description ?? "").toLowerCase();
  const matches: DeductionMatch[] = [];

  for (const rule of DEDUCTION_RULES) {
    if (!isRuleEligible(rule, context)) continue;

    const keywordStats = scoreKeywordMatches(rule, merchant, description);
    if (keywordStats.matchedKeywords.length === 0) continue;

    const confidence = calculateConfidence(rule, keywordStats, context);
    if (confidence < minConfidence) continue;

    const amount = parseAmount(transaction.totalAmount);
    const deductionPercent = rule.deductionPercent;
    const potentialDeduction = roundCurrency(amount * deductionPercent);

    matches.push({
      transactionId: transaction.id,
      category: rule.category,
      ruleId: rule.id,
      confidence,
      deductionPercent,
      irsCategory: rule.irsCategory,
      matchedKeywords: keywordStats.matchedKeywords,
      amount,
      potentialDeduction,
      merchant: transaction.merchant,
      description: transaction.description,
    });
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

type KeywordStats = {
  matchedKeywords: string[];
  merchantMatches: number;
  descriptionMatches: number;
  coverage: number;
};

function scoreKeywordMatches(
  rule: DeductionRule,
  merchant: string,
  description: string
): KeywordStats {
  const matchedKeywords = new Set<string>();
  let merchantMatches = 0;
  let descriptionMatches = 0;

  for (const keyword of rule.keywords) {
    const normalized = keyword.toLowerCase();
    let matched = false;

    if (merchant.includes(normalized)) {
      merchantMatches += 1;
      matched = true;
    }

    if (description.includes(normalized)) {
      descriptionMatches += 1;
      matched = true;
    }

    if (matched) {
      matchedKeywords.add(normalized);
    }
  }

  const coverage = matchedKeywords.size / rule.keywords.length;

  return {
    matchedKeywords: Array.from(matchedKeywords),
    merchantMatches,
    descriptionMatches,
    coverage,
  };
}

function calculateConfidence(
  rule: DeductionRule,
  stats: KeywordStats,
  context: DeductionContext
): number {
  let confidence = rule.baseConfidence + stats.coverage * 0.4;

  if (stats.merchantMatches > 0) {
    confidence += 0.1;
  }

  if (stats.descriptionMatches > 1) {
    confidence += 0.05;
  }

  confidence += contextAdjustment(rule.category, context);

  return clamp(confidence, 0, 0.95);
}

function contextAdjustment(category: DeductionMatch["category"], context: DeductionContext): number {
  let adjustment = 0;

  if (category === "HOME_OFFICE") {
    if (context.worksFromHome === true) adjustment += 0.05;
    if (context.worksFromHome === undefined) adjustment -= 0.05;
  }

  if (category === "BUSINESS_TRAVEL") {
    if (context.isFreelancer === true) adjustment += 0.05;
    if (context.isFreelancer === false) adjustment -= 0.05;
  }

  if (category === "PROFESSIONAL_DEVELOPMENT") {
    if (context.isFreelancer === true) adjustment += 0.05;
    if (context.isFreelancer === false) adjustment -= 0.05;
  }

  if (category === "HEALTH") {
    if (context.hasHealthInsurance === true) adjustment += 0.05;
  }

  return adjustment;
}

function isRuleEligible(rule: DeductionRule, context: DeductionContext): boolean {
  if (!rule.requires || rule.requires.length === 0) return true;

  return !rule.requires.some((requirement) => context[requirement] === false);
}

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
