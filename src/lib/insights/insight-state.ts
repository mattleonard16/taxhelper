import type { Insight } from "./types";

const buildInsightKey = (insight: Insight) => {
  const ids = Array.from(new Set(insight.supportingTransactionIds)).sort();
  return `${insight.type}:${ids.join(",")}`;
};

export const mergeInsightState = (
  nextInsights: Insight[],
  previousInsights: Insight[]
) => {
  const previousState = new Map<
    string,
    { pinned?: boolean; dismissed?: boolean }
  >();

  for (const insight of previousInsights) {
    previousState.set(buildInsightKey(insight), {
      pinned: insight.pinned,
      dismissed: insight.dismissed,
    });
  }

  return nextInsights.map((insight) => {
    const state = previousState.get(buildInsightKey(insight));
    if (!state) return insight;

    return {
      ...insight,
      pinned: state.pinned ?? insight.pinned,
      dismissed: state.dismissed ?? insight.dismissed,
    };
  });
};
