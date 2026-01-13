"use client";

import { useState, useEffect, useCallback } from "react";

export interface TransactionFilters {
  fromDate: string;
  toDate: string;
  typeFilter: string;
  search: string;
  minAmount: string;
  maxAmount: string;
  category: string;
  isDeductible: string; // "all" | "true" | "false"
  priority: string; // "all" | "HIGH" | "MEDIUM" | "LOW"
}

const STORAGE_KEY = "taxhelper:transaction-filters";

const defaultFilters: TransactionFilters = {
  fromDate: "",
  toDate: "",
  typeFilter: "all",
  search: "",
  minAmount: "",
  maxAmount: "",
  category: "all",
  isDeductible: "all",
  priority: "all",
};

function loadFiltersFromStorage(): TransactionFilters {
  if (typeof window === "undefined") return defaultFilters;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultFilters, ...parsed };
    }
  } catch {
    // Ignore localStorage errors
  }
  return defaultFilters;
}

export function usePersistedFilters() {
  const [filters, setFilters] = useState<TransactionFilters>(loadFiltersFromStorage);
  const loaded = typeof window !== "undefined";

  // Save to localStorage on change
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // Ignore localStorage errors
    }
  }, [filters, loaded]);

  const updateFilter = useCallback(<K extends keyof TransactionFilters>(
    key: K,
    value: TransactionFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const hasActiveFilters = 
    filters.fromDate !== "" ||
    filters.toDate !== "" ||
    filters.typeFilter !== "all" ||
    filters.search !== "" ||
    filters.minAmount !== "" ||
    filters.maxAmount !== "" ||
    filters.category !== "all" ||
    filters.isDeductible !== "all" ||
    filters.priority !== "all";

  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    loaded,
  };
}
