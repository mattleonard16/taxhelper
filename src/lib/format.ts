export function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

export function getDateRanges() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Start of this week (Sunday)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  // Start of last 7 days
  const last7Days = new Date(today);
  last7Days.setDate(today.getDate() - 6);
  
  // Start of last 30 days
  const last30Days = new Date(today);
  last30Days.setDate(today.getDate() - 29);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  
  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  const todayStr = formatDate(today);
  
  return {
    today: {
      label: "Today",
      from: todayStr,
      to: todayStr,
    },
    last7Days: {
      label: "Last 7 days",
      from: formatDate(last7Days),
      to: todayStr,
    },
    thisWeek: {
      label: "This week",
      from: formatDate(startOfWeek),
      to: todayStr,
    },
    last30Days: {
      label: "Last 30 days",
      from: formatDate(last30Days),
      to: todayStr,
    },
    thisMonth: {
      label: "This month",
      from: formatDate(startOfMonth),
      to: todayStr,
    },
    thisYear: {
      label: "This year",
      from: formatDate(startOfYear),
      to: todayStr,
    },
  };
}

export type DateRangeKey = keyof ReturnType<typeof getDateRanges>;

