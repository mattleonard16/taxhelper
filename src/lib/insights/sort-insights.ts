import type { Insight } from "./types";

export const sortInsights = (insights: Insight[]) => {
  return [...insights].sort((a, b) => {
    const aDismissed = a.dismissed ? 1 : 0;
    const bDismissed = b.dismissed ? 1 : 0;
    if (aDismissed !== bDismissed) {
      return aDismissed - bDismissed;
    }

    const aPinned = a.pinned ? 1 : 0;
    const bPinned = b.pinned ? 1 : 0;
    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }

    return b.severityScore - a.severityScore;
  });
};
