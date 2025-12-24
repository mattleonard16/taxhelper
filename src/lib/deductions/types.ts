export const DEDUCTION_CATEGORIES = {
  HOME_OFFICE: "HOME_OFFICE",
  BUSINESS_TRAVEL: "BUSINESS_TRAVEL",
  OFFICE_SUPPLIES: "OFFICE_SUPPLIES",
  PROFESSIONAL_DEVELOPMENT: "PROFESSIONAL_DEVELOPMENT",
  HEALTH: "HEALTH",
  CHARITY: "CHARITY",
} as const;

export type DeductionCategory =
  (typeof DEDUCTION_CATEGORIES)[keyof typeof DEDUCTION_CATEGORIES];

export type DeductionContext = {
  isFreelancer?: boolean;
  worksFromHome?: boolean;
  hasHealthInsurance?: boolean;
  estimatedTaxRate?: number;
};

export type DeductionRule = {
  id: string;
  category: DeductionCategory;
  keywords: string[];
  deductionPercent: number;
  irsCategory: string;
  baseConfidence: number;
  requires?: Array<keyof DeductionContext>;
};

export type DeductionMatch = {
  transactionId: string;
  category: DeductionCategory;
  ruleId: string;
  confidence: number;
  deductionPercent: number;
  irsCategory: string;
  matchedKeywords: string[];
  amount: number;
  potentialDeduction: number;
  merchant: string | null;
  description: string | null;
};

export type DeductionSummary = {
  category: DeductionCategory;
  potentialDeduction: number;
  estimatedSavings: number;
  transactions: string[];
  suggestion: string;
  confidence: number;
};

export type DeductionSummaryResult = {
  deductions: DeductionSummary[];
  totalPotentialDeduction: number;
  estimatedTaxSavings: number;
};
