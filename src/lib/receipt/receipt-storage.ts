/**
 * Receipt storage utilities for async processing.
 * Uses local filesystem by default; override with RECEIPT_STORAGE_ROOT.
 */

import fs from "fs/promises";
import path from "path";

const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), ".receipt-storage");

function getStorageRoot(): string {
  return process.env.RECEIPT_STORAGE_ROOT || DEFAULT_STORAGE_ROOT;
}

function resolveStoragePath(storagePath: string): string {
  const root = path.resolve(getStorageRoot());
  const resolved = path.resolve(root, storagePath);

  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid storage path");
  }

  return resolved;
}

export async function storeReceiptBytes(storagePath: string, bytes: ArrayBuffer): Promise<void> {
  const filePath = resolveStoragePath(storagePath);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(bytes));
}

export async function getReceiptBytes(storagePath: string): Promise<ArrayBuffer | null> {
  const filePath = resolveStoragePath(storagePath);

  try {
    const data = await fs.readFile(filePath);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return null;
      }
    }
    throw error;
  }
}
