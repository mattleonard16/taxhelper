export type DateBoundary = "start" | "end" | "midday";

/**
 * Parses a date string from either:
 * - YYYY-MM-DD (HTML date inputs)
 * - ISO datetime (with or without timezone)
 *
 * For YYYY-MM-DD, appends a local-time component so it doesn't get parsed as UTC
 * midnight (which can render as the previous day in negative timezones).
 */
export function parseDateInput(value: string, boundary: DateBoundary = "midday"): Date {
  if (value.includes("T")) {
    return new Date(value);
  }

  switch (boundary) {
    case "start":
      return new Date(`${value}T00:00:00`);
    case "end":
      return new Date(`${value}T23:59:59.999`);
    case "midday":
    default:
      return new Date(`${value}T12:00:00`);
  }
}

