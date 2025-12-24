import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReceiptJobRepository } from "../receipt-job-repository";

vi.mock("../receipt-job-repository", () => ({
  createReceiptJobRepository: vi.fn(),
}));

describe("receipt job worker", () => {
  let runReceiptJobWorker: typeof import("../receipt-job-worker").runReceiptJobWorker;

  beforeAll(async () => {
    ({ runReceiptJobWorker } = await import("../receipt-job-worker"));
  });

  it("requeues stale jobs before processing", async () => {
    const { createReceiptJobRepository } = await import("../receipt-job-repository");
    const requeueStaleJobs = vi.fn().mockResolvedValue([]);
    const findPendingJobs = vi.fn().mockResolvedValue([]);
    vi.mocked(createReceiptJobRepository).mockReturnValue({
      requeueStaleJobs,
      findPendingJobs,
    } as unknown as ReceiptJobRepository);

    const result = await runReceiptJobWorker(5, async () => null, { staleAfterMs: 60_000 });

    expect(requeueStaleJobs).toHaveBeenCalledWith(60_000);
    expect(findPendingJobs).toHaveBeenCalled();
    expect(result.processed).toBe(0);
  });
});
