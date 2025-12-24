// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { getReceiptBytes, storeReceiptBytes } from "../receipt-storage";

describe("receipt storage", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "receipt-storage-"));
    process.env.RECEIPT_STORAGE_ROOT = tempDir;
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.RECEIPT_STORAGE_ROOT;
  });

  it("stores and retrieves bytes by storage path", async () => {
    const input = new TextEncoder().encode("test-bytes").buffer;
    const storagePath = "receipts/user-1/OTHER/test.txt";

    await storeReceiptBytes(storagePath, input);
    const result = await getReceiptBytes(storagePath);

    expect(result).not.toBeNull();
    const text = new TextDecoder().decode(new Uint8Array(result ?? new ArrayBuffer(0)));
    expect(text).toBe("test-bytes");
  });

  it("returns null when the file is missing", async () => {
    const result = await getReceiptBytes("receipts/user-1/OTHER/missing.txt");

    expect(result).toBeNull();
  });
});
