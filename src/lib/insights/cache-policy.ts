const PRODUCTION_TTL_HOURS = 6;
const DEVELOPMENT_TTL_HOURS = 1;
const MS_PER_HOUR = 60 * 60 * 1000;

const getDefaultTtlHours = () => {
  return process.env.NODE_ENV === "production" ? PRODUCTION_TTL_HOURS : DEVELOPMENT_TTL_HOURS;
};

const parseTtlHours = (raw: string | undefined) => {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

export const getInsightCacheTtlMs = () => {
  const ttlHours = parseTtlHours(process.env.INSIGHT_CACHE_TTL_HOURS) ?? getDefaultTtlHours();
  return ttlHours * MS_PER_HOUR;
};

export const isInsightRunFresh = (generatedAt: Date, now = new Date()) => {
  return now.getTime() - generatedAt.getTime() < getInsightCacheTtlMs();
};
