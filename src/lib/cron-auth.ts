import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

export function isValidCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7);

  // Use constant-time comparison to prevent timing attacks
  if (token.length !== cronSecret.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
}
