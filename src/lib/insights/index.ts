import { detectQuietLeaks } from './quiet-leaks';
import { detectTaxDrag } from './tax-drag';
import { detectSpikes } from './spikes';
import type { Insight } from './types';
import { createInsightRepository } from './insight-repository';
import { createTransactionRepository } from './transaction-repository';
import { isInsightRunFresh } from './cache-policy';
import { sortInsights } from './sort-insights';
import { mergeInsightState } from './insight-state';

export { type Insight, type InsightType, INSIGHT_TYPES } from './types';

type GetInsightsOptions = {
  forceRefresh?: boolean;
};

export async function getInsights(
  userId: string,
  rangeDays: number = 30,
  options: GetInsightsOptions = {}
): Promise<Insight[]> {
  const insightRepository = createInsightRepository();
  const transactionRepository = createTransactionRepository();

  const cachedRun = await insightRepository.findLatestRun(userId, rangeDays);
  if (!options.forceRefresh && cachedRun && isInsightRunFresh(cachedRun.generatedAt)) {
    const latestUpdate = await transactionRepository.getLatestUpdatedAt(userId);
    if (!latestUpdate || cachedRun.generatedAt >= latestUpdate) {
      return sortInsights(cachedRun.insights);
    }
  }

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - rangeDays);

  const transactions = await transactionRepository.listByUserSince(userId, fromDate);

  const quietLeaks = detectQuietLeaks(transactions);
  const taxDrag = detectTaxDrag(transactions);
  const spikes = detectSpikes(transactions);

  const nextInsights = [...quietLeaks, ...taxDrag, ...spikes];
  const mergedInsights = mergeInsightState(nextInsights, cachedRun?.insights ?? []);
  const orderedInsights = sortInsights(mergedInsights);
  const savedRun = await insightRepository.createRun(userId, rangeDays, orderedInsights);

  return sortInsights(savedRun.insights);
}

// Export individual generators for direct use if needed
export { detectQuietLeaks } from './quiet-leaks';
export { detectTaxDrag } from './tax-drag';
export { detectSpikes } from './spikes';
