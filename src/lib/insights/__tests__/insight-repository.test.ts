import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInsightRepository } from '../insight-repository';
import type { Insight, InsightExplanation } from '../types';

// Mock Prisma client
const mockInsightRun = {
  findFirst: vi.fn(),
  create: vi.fn(),
};

const mockInsight = {
  findFirst: vi.fn(),
  update: vi.fn(),
};

const mockPrisma = {
  insightRun: mockInsightRun,
  insight: mockInsight,
} as unknown as Parameters<typeof createInsightRepository>[0];

const sampleExplanation: InsightExplanation = {
  reason: 'You have recurring small purchases at Coffee that add up over time.',
  thresholds: [
    { name: 'occurrences', actual: 5, threshold: 3 },
    { name: 'cumulative total', actual: '$75.00', threshold: '$50' },
  ],
  suggestion: 'Consider reducing these purchases.',
};

const sampleInsight: Insight = {
  type: 'QUIET_LEAK',
  title: 'Quiet Leak: Coffee',
  summary: '5 purchases totaling $75.00',
  severityScore: 3,
  supportingTransactionIds: ['tx1', 'tx2', 'tx3'],
  explanation: sampleExplanation,
};

describe('InsightRepository explanation persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists explanation when creating a run', async () => {
    const createdRun = {
      id: 'run-1',
      userId: 'user-1',
      range: 30,
      generatedAt: new Date(),
      insights: [
        {
          id: 'insight-1',
          runId: 'run-1',
          type: 'QUIET_LEAK',
          title: sampleInsight.title,
          summary: sampleInsight.summary,
          severityScore: 3,
          supportingTransactionIds: sampleInsight.supportingTransactionIds,
          dismissed: false,
          pinned: false,
          explanation: sampleExplanation,
        },
      ],
    };

    mockInsightRun.create.mockResolvedValue(createdRun);

    const repository = createInsightRepository(mockPrisma);
    const result = await repository.createRun('user-1', 30, [sampleInsight]);

    // Verify explanation was passed to Prisma
    expect(mockInsightRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          insights: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                explanation: sampleExplanation,
              }),
            ]),
          }),
        }),
      })
    );

    // Verify explanation is returned
    expect(result.insights[0].explanation).toEqual(sampleExplanation);
  });

  it('loads explanation when finding latest run', async () => {
    const storedRun = {
      id: 'run-1',
      userId: 'user-1',
      range: 30,
      generatedAt: new Date(),
      insights: [
        {
          id: 'insight-1',
          runId: 'run-1',
          type: 'QUIET_LEAK',
          title: 'Quiet Leak: Coffee',
          summary: '5 purchases',
          severityScore: 3,
          supportingTransactionIds: ['tx1'],
          dismissed: false,
          pinned: false,
          explanation: sampleExplanation,
        },
      ],
    };

    mockInsightRun.findFirst.mockResolvedValue(storedRun);

    const repository = createInsightRepository(mockPrisma);
    const result = await repository.findLatestRun('user-1', 30);

    expect(result).not.toBeNull();
    expect(result!.insights[0].explanation).toEqual(sampleExplanation);
    expect(result!.insights[0].explanation?.reason).toBe(sampleExplanation.reason);
    expect(result!.insights[0].explanation?.thresholds).toHaveLength(2);
    expect(result!.insights[0].explanation?.suggestion).toBe(sampleExplanation.suggestion);
  });

  it('handles null explanation gracefully', async () => {
    const storedRun = {
      id: 'run-1',
      userId: 'user-1',
      range: 30,
      generatedAt: new Date(),
      insights: [
        {
          id: 'insight-1',
          runId: 'run-1',
          type: 'QUIET_LEAK',
          title: 'Quiet Leak: Coffee',
          summary: '5 purchases',
          severityScore: 3,
          supportingTransactionIds: ['tx1'],
          dismissed: false,
          pinned: false,
          explanation: null,
        },
      ],
    };

    mockInsightRun.findFirst.mockResolvedValue(storedRun);

    const repository = createInsightRepository(mockPrisma);
    const result = await repository.findLatestRun('user-1', 30);

    expect(result).not.toBeNull();
    expect(result!.insights[0].explanation).toBeUndefined();
  });

  it('handles invalid JSON in explanation field', async () => {
    const storedRun = {
      id: 'run-1',
      userId: 'user-1',
      range: 30,
      generatedAt: new Date(),
      insights: [
        {
          id: 'insight-1',
          runId: 'run-1',
          type: 'QUIET_LEAK',
          title: 'Quiet Leak: Coffee',
          summary: '5 purchases',
          severityScore: 3,
          supportingTransactionIds: ['tx1'],
          dismissed: false,
          pinned: false,
          explanation: 'not a valid object', // Invalid - should be an object
        },
      ],
    };

    mockInsightRun.findFirst.mockResolvedValue(storedRun);

    const repository = createInsightRepository(mockPrisma);
    const result = await repository.findLatestRun('user-1', 30);

    expect(result).not.toBeNull();
    expect(result!.insights[0].explanation).toBeUndefined();
  });

  it('filters invalid threshold entries', async () => {
    const validThreshold = { name: 'occurrences', actual: 5, threshold: 3 };
    const storedRun = {
      id: 'run-1',
      userId: 'user-1',
      range: 30,
      generatedAt: new Date(),
      insights: [
        {
          id: 'insight-1',
          runId: 'run-1',
          type: 'QUIET_LEAK',
          title: 'Quiet Leak: Coffee',
          summary: '5 purchases',
          severityScore: 3,
          supportingTransactionIds: ['tx1'],
          dismissed: false,
          pinned: false,
          explanation: {
            reason: 'Recurring purchases.',
            thresholds: [
              validThreshold,
              { name: 42, actual: { amount: 10 }, threshold: [] },
            ],
            suggestion: 'Review.',
          },
        },
      ],
    };

    mockInsightRun.findFirst.mockResolvedValue(storedRun);

    const repository = createInsightRepository(mockPrisma);
    const result = await repository.findLatestRun('user-1', 30);

    expect(result).not.toBeNull();
    expect(result!.insights[0].explanation?.thresholds).toEqual([validThreshold]);
  });

  it('drops non-string suggestion values', async () => {
    const storedRun = {
      id: 'run-1',
      userId: 'user-1',
      range: 30,
      generatedAt: new Date(),
      insights: [
        {
          id: 'insight-1',
          runId: 'run-1',
          type: 'QUIET_LEAK',
          title: 'Quiet Leak: Coffee',
          summary: '5 purchases',
          severityScore: 3,
          supportingTransactionIds: ['tx1'],
          dismissed: false,
          pinned: false,
          explanation: {
            reason: 'Recurring purchases.',
            thresholds: [{ name: 'occurrences', actual: 5, threshold: 3 }],
            suggestion: 123,
          },
        },
      ],
    };

    mockInsightRun.findFirst.mockResolvedValue(storedRun);

    const repository = createInsightRepository(mockPrisma);
    const result = await repository.findLatestRun('user-1', 30);

    expect(result).not.toBeNull();
    expect(result!.insights[0].explanation?.suggestion).toBeUndefined();
  });
});
