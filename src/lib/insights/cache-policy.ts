const DEFAULT_TTL_HOURS = 6;
const MS_PER_HOUR = 60 * 60 * 1000;

const parseTtlHours = (raw: string | undefined) => {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

export const getInsightCacheTtlMs = () => {
  const ttlHours = parseTtlHours(process.env.INSIGHT_CACHE_TTL_HOURS) ?? DEFAULT_TTL_HOURS;
  return ttlHours * MS_PER_HOUR;
};

export const isInsightRunFresh = (generatedAt: Date, now = new Date()) => {
  return now.getTime() - generatedAt.getTime() < getInsightCacheTtlMs();
};
