---
name: prisma-patterns
description: Prisma schema conventions, migrations, and query patterns for TaxHelper. Use when modifying the database schema, writing complex queries, or optimizing database access.
---

# Prisma Patterns Skill

This skill provides guidance for working with Prisma in TaxHelper.

## When to Use This Skill

- Modifying the database schema
- Creating migrations
- Writing efficient queries
- Adding indexes for performance
- Working with Decimal types
- Implementing the repository pattern

## Project Setup

- Schema: `prisma/schema.prisma`
- Client: `src/lib/prisma.ts`
- Migrations: `prisma/migrations/`

### Commands

```bash
# Validate schema
npx prisma validate

# Create migration
npx prisma migrate dev --name descriptive_name

# Apply migrations (production)
npx prisma migrate deploy

# Generate client after schema changes
npx prisma generate

# Reset database (development only)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## Schema Conventions

### Model Structure

```prisma
model Transaction {
  // 1. Primary key
  id          String          @id @default(cuid())
  
  // 2. Foreign keys and relations
  userId      String
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // 3. Core fields
  date        DateTime
  type        TransactionType
  description String?
  merchant    String?
  
  // 4. Money fields (always Decimal)
  totalAmount Decimal         @db.Decimal(12, 2)
  taxAmount   Decimal         @db.Decimal(12, 2)
  
  // 5. Metadata
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  // 6. Indexes at bottom
  @@index([userId])
  @@index([date])
  @@index([userId, date])
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Models | PascalCase singular | `Transaction`, `User` |
| Fields | camelCase | `userId`, `totalAmount` |
| Enums | PascalCase | `TransactionType` |
| Enum values | SCREAMING_SNAKE | `SALES_TAX`, `INCOME_TAX` |
| Indexes | Implicit naming | `@@index([userId, date])` |

### Money Fields

Always use `Decimal` for monetary values:

```prisma
totalAmount Decimal @db.Decimal(12, 2)  // Up to 9,999,999,999.99
taxRate     Decimal @db.Decimal(10, 6)  // 0.088750 for 8.875%
```

### Enums

Define enums at the bottom of schema:

```prisma
enum TransactionType {
  SALES_TAX
  INCOME_TAX
  OTHER
}

enum ReceiptJobStatus {
  QUEUED
  PROCESSING
  NEEDS_REVIEW
  COMPLETED
  CONFIRMED
  FAILED
}
```

## Indexing Strategy

### Single-Column Indexes

Add for frequently filtered/sorted columns:

```prisma
@@index([userId])      // Filter by user
@@index([date])        // Sort by date
@@index([type])        // Filter by type
@@index([status])      // Filter by status
```

### Composite Indexes

Add for common query patterns (order matters!):

```prisma
@@index([userId, date])           // User's transactions by date
@@index([userId, type, date])     // User's transactions filtered by type
@@index([userId, status])         // User's jobs by status
@@index([userId, status, createdAt])  // Inbox list query
```

### Unique Constraints

```prisma
@@unique([userId, date])           // One record per user per day
@@unique([provider, providerAccountId])  // OAuth uniqueness
transactionId String? @unique      // Prevent duplicate links
```

## Query Patterns

### Basic CRUD

```typescript
import { prisma } from "@/lib/prisma";

// Create
const transaction = await prisma.transaction.create({
  data: {
    userId: user.id,
    date: new Date(),
    type: "SALES_TAX",
    totalAmount: new Prisma.Decimal("100.00"),
    taxAmount: new Prisma.Decimal("8.88"),
  },
});

// Read with filter
const transactions = await prisma.transaction.findMany({
  where: {
    userId: user.id,
    date: { gte: startDate, lte: endDate },
  },
  orderBy: { date: "desc" },
  take: 20,
  skip: 0,
});

// Update
await prisma.transaction.update({
  where: { id, userId: user.id },
  data: { merchant: "Updated Merchant" },
});

// Delete
await prisma.transaction.delete({
  where: { id, userId: user.id },
});
```

### Aggregations

```typescript
// Sum and count
const stats = await prisma.transaction.aggregate({
  where: { userId: user.id },
  _sum: { taxAmount: true, totalAmount: true },
  _count: true,
  _avg: { taxAmount: true },
});

// Access results
const totalTax = stats._sum.taxAmount || new Prisma.Decimal(0);
const count = stats._count;
```

### Group By

```typescript
const byType = await prisma.transaction.groupBy({
  by: ["type"],
  where: { userId: user.id },
  _sum: { taxAmount: true, totalAmount: true },
});

// Transform to object
const result: Record<string, Prisma.Decimal> = {};
for (const item of byType) {
  result[item.type] = item._sum.taxAmount || new Prisma.Decimal(0);
}
```

### Top N with Aggregation

```typescript
const topMerchants = await prisma.transaction.groupBy({
  by: ["merchant"],
  where: {
    userId: user.id,
    merchant: { not: null },
  },
  _sum: { taxAmount: true },
  orderBy: { _sum: { taxAmount: "desc" } },
  take: 5,
});
```

### Raw SQL for Complex Queries

```typescript
const dailyTotals = await prisma.$queryRaw<
  Array<{ date_key: Date; total_tax: Prisma.Decimal }>
>`
  SELECT 
    DATE("date") as date_key,
    SUM("taxAmount") as total_tax
  FROM "Transaction"
  WHERE "userId" = ${user.id}
    AND "date" >= ${fromDate}
    AND "date" <= ${toDate}
  GROUP BY DATE("date")
  ORDER BY date_key ASC
`;
```

### Transactions (Atomic Operations)

```typescript
const [job, transaction] = await prisma.$transaction([
  prisma.receiptJob.update({
    where: { id: jobId },
    data: { status: "CONFIRMED", transactionId },
  }),
  prisma.transaction.create({
    data: { ... },
  }),
]);

// Or with callback for dependent operations
await prisma.$transaction(async (tx) => {
  const job = await tx.receiptJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  
  const transaction = await tx.transaction.create({ data: { ... } });
  await tx.receiptJob.update({
    where: { id: jobId },
    data: { transactionId: transaction.id },
  });
});
```

## Decimal Handling

### In API Responses

Always convert to string for JSON:

```typescript
const response = {
  totalAmount: transaction.totalAmount.toString(),
  taxAmount: transaction.taxAmount.toString(),
};
```

### In Calculations

```typescript
import { Prisma } from "@prisma/client";

// Create from string
const amount = new Prisma.Decimal("100.50");

// Arithmetic
const result = amount.add(other);
const result = amount.sub(other);
const result = amount.mul(rate);
const result = amount.div(divisor);

// Comparison
if (amount.isZero()) { ... }
if (amount.gt(other)) { ... }
if (amount.lte(other)) { ... }

// Formatting
const rounded = amount.toDecimalPlaces(2);
const number = amount.toNumber();  // Use sparingly, loses precision
```

## Repository Pattern

Create repository files for complex data access:

```typescript
// src/lib/receipt/receipt-job-repository.ts
import { prisma } from "@/lib/prisma";
import { ReceiptJobStatus } from "@prisma/client";

export async function findPendingJobs(userId: string, limit = 10) {
  return prisma.receiptJob.findMany({
    where: { userId, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function updateJobStatus(
  id: string,
  status: ReceiptJobStatus,
  data?: Partial<{ lastError: string; processedAt: Date }>
) {
  return prisma.receiptJob.update({
    where: { id },
    data: { status, ...data, updatedAt: new Date() },
  });
}
```

## Migration Best Practices

1. **Descriptive names**: `npx prisma migrate dev --name add_category_to_transactions`

2. **Non-breaking changes first**: Add nullable columns before making them required

3. **Data migrations**: Use separate scripts, not Prisma migrations

4. **Review generated SQL**: Check `prisma/migrations/*/migration.sql`

5. **Test migrations**: Reset dev database and run all migrations

```bash
npx prisma migrate reset  # Development only!
```
