import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const statements = [
  `PRAGMA foreign_keys = ON`,
  `CREATE TABLE IF NOT EXISTS "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Store_code_key" ON "Store"("code")`,
  `CREATE TABLE IF NOT EXISTS "ResponsibilityParty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serviceCategories" TEXT NOT NULL,
    "serviceRegions" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ResponsibilityParty_code_key" ON "ResponsibilityParty"("code")`,
  `CREATE TABLE IF NOT EXISTS "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "defaultPartyId" TEXT,
    "warrantyStatus" TEXT NOT NULL,
    "warrantyEndDate" DATETIME,
    "operationalStatus" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Asset_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asset_defaultPartyId_fkey" FOREIGN KEY ("defaultPartyId") REFERENCES "ResponsibilityParty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Asset_code_key" ON "Asset"("code")`,
  `CREATE INDEX IF NOT EXISTS "Asset_storeId_idx" ON "Asset"("storeId")`,
  `CREATE TABLE IF NOT EXISTS "RoutingRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL,
    "assetCategories" TEXT NOT NULL,
    "faultCategories" TEXT NOT NULL,
    "riskTags" TEXT NOT NULL,
    "warrantyCondition" TEXT NOT NULL,
    "regions" TEXT NOT NULL,
    "responsibilityPartyId" TEXT,
    "priorityLevel" TEXT NOT NULL,
    "acceptanceSlaSeconds" INTEGER NOT NULL,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "notifyOps" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "RoutingRule_responsibilityPartyId_fkey" FOREIGN KEY ("responsibilityPartyId") REFERENCES "ResponsibilityParty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RoutingRule_code_key" ON "RoutingRule"("code")`,
  `CREATE TABLE IF NOT EXISTS "FaultEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "assetId" TEXT,
    "originalDescription" TEXT NOT NULL,
    "attachmentUrls" TEXT NOT NULL,
    "occurredAtText" TEXT NOT NULL,
    "productionImpact" TEXT NOT NULL,
    "businessImpact" TEXT NOT NULL,
    "userRiskTags" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "aiResultJson" TEXT NOT NULL,
    "aiHistoryJson" TEXT NOT NULL DEFAULT '[]',
    "aiSummary" TEXT NOT NULL,
    "aiFaultCategory" TEXT NOT NULL,
    "aiPrioritySuggestion" TEXT NOT NULL,
    "aiConfidence" TEXT NOT NULL,
    "missingFields" TEXT NOT NULL,
    "followUpQuestions" TEXT NOT NULL,
    "requiresHumanReview" BOOLEAN NOT NULL,
    "supplementText" TEXT,
    "analysisVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "FaultEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FaultEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FaultEvent_code_key" ON "FaultEvent"("code")`,
  `CREATE INDEX IF NOT EXISTS "FaultEvent_storeId_status_idx" ON "FaultEvent"("storeId", "status")`,
  `CREATE TABLE IF NOT EXISTS "WorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "faultEventId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "finalFaultCategory" TEXT NOT NULL,
    "finalPriority" TEXT NOT NULL,
    "recommendedPartyId" TEXT,
    "finalPartyId" TEXT,
    "routeExplanation" TEXT NOT NULL,
    "routeTraceJson" TEXT NOT NULL,
    "manuallyReviewed" BOOLEAN NOT NULL DEFAULT false,
    "manualReviewReason" TEXT,
    "status" TEXT NOT NULL,
    "slaStatus" TEXT NOT NULL,
    "dispatchedAt" DATETIME,
    "acceptanceDeadline" DATETIME,
    "acceptedAt" DATETIME,
    "repairStartedAt" DATETIME,
    "repairCompletedAt" DATETIME,
    "acceptanceAt" DATETIME,
    "closedAt" DATETIME,
    "repairCause" TEXT,
    "repairAction" TEXT,
    "partsUsed" TEXT,
    "acceptanceResult" TEXT,
    "acceptanceComment" TEXT,
    "rejectionReason" TEXT,
    "returnCount" INTEGER NOT NULL DEFAULT 0,
    "repeatedFault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "WorkOrder_faultEventId_fkey" FOREIGN KEY ("faultEventId") REFERENCES "FaultEvent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_recommendedPartyId_fkey" FOREIGN KEY ("recommendedPartyId") REFERENCES "ResponsibilityParty" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_finalPartyId_fkey" FOREIGN KEY ("finalPartyId") REFERENCES "ResponsibilityParty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrder_code_key" ON "WorkOrder"("code")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrder_faultEventId_key" ON "WorkOrder"("faultEventId")`,
  `CREATE INDEX IF NOT EXISTS "WorkOrder_status_finalPriority_idx" ON "WorkOrder"("status", "finalPriority")`,
  `CREATE TABLE IF NOT EXISTS "StateEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StateEvent_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "StateEvent_workOrderId_timestamp_idx" ON "StateEvent"("workOrderId", "timestamp")`,
  `CREATE TABLE IF NOT EXISTS "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "NotificationLog_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
];

async function main() {
  try {
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
    const faultColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info("FaultEvent")`,
    );
    if (!faultColumns.some((column) => column.name === "aiHistoryJson")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "FaultEvent" ADD COLUMN "aiHistoryJson" TEXT NOT NULL DEFAULT '[]'`,
      );
    }
    console.log("SQLite 数据库结构已初始化。");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
