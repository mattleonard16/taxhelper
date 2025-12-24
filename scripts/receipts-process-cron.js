#!/usr/bin/env node

const baseUrl = process.env.CRON_JOB_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const cronSecret = process.env.CRON_SECRET;
const limit = process.env.RECEIPT_WORKER_LIMIT;

if (!cronSecret) {
  console.error("CRON_SECRET is required to trigger receipt processing.");
  process.exit(1);
}

const url = new URL("/api/receipts/process", baseUrl);
if (limit) {
  url.searchParams.set("limit", limit);
}

async function run() {
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
  });

  const bodyText = await response.text();

  if (!response.ok) {
    console.error(`Receipt worker failed (${response.status}): ${bodyText}`);
    process.exit(1);
  }

  console.log(bodyText);
}

run().catch((error) => {
  console.error("Receipt worker request failed:", error);
  process.exit(1);
});
