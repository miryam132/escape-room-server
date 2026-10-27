-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PLAYER');

-- CreateEnum
CREATE TYPE "HotspotType" AS ENUM ('INFO', 'PUZZLE');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "AnswerType" AS ENUM ('text', 'number');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageKey" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotspot" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "xpercent" DOUBLE PRECISION NOT NULL,
    "ypercent" DOUBLE PRECISION NOT NULL,
    "type" "HotspotType" NOT NULL,
    "content" TEXT NOT NULL,
    "question" TEXT,
    "answerType" "AnswerType",
    "answer" TEXT,
    "hint" TEXT,
    "solvedContent" TEXT,
    "prerequisiteId" UUID,
    "lockedMessage" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Hotspot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GameProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolvedHotspot" (
    "progressId" UUID NOT NULL,
    "hotspotId" UUID NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolvedHotspot_pkey" PRIMARY KEY ("progressId","hotspotId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Room_imageKey_key" ON "Room"("imageKey");

-- CreateIndex
CREATE INDEX "Hotspot_roomId_idx" ON "Hotspot"("roomId");

-- CreateIndex
CREATE INDEX "GameProgress_roomId_idx" ON "GameProgress"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "GameProgress_userId_roomId_key" ON "GameProgress"("userId", "roomId");

-- CreateIndex
CREATE INDEX "SolvedHotspot_hotspotId_idx" ON "SolvedHotspot"("hotspotId");

-- AddForeignKey
ALTER TABLE "Hotspot" ADD CONSTRAINT "Hotspot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotspot" ADD CONSTRAINT "Hotspot_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Hotspot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameProgress" ADD CONSTRAINT "GameProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameProgress" ADD CONSTRAINT "GameProgress_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvedHotspot" ADD CONSTRAINT "SolvedHotspot_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "GameProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvedHotspot" ADD CONSTRAINT "SolvedHotspot_hotspotId_fkey" FOREIGN KEY ("hotspotId") REFERENCES "Hotspot"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Database-level safeguards (application also validates these rules).
ALTER TABLE "Hotspot" ADD CONSTRAINT "hotspot_coordinates" CHECK ("xpercent" BETWEEN 0 AND 100 AND "ypercent" BETWEEN 0 AND 100);
ALTER TABLE "Hotspot" ADD CONSTRAINT "hotspot_not_own_prerequisite" CHECK ("prerequisiteId" IS DISTINCT FROM id);
ALTER TABLE "Hotspot" ADD CONSTRAINT "final_is_puzzle" CHECK (NOT "isFinal" OR type = 'PUZZLE');
CREATE UNIQUE INDEX "one_final_puzzle_per_room" ON "Hotspot"("roomId") WHERE "isFinal";
-- No browser access through Supabase Data API. Prisma runs as table owner.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Hotspot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GameProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SolvedHotspot" ENABLE ROW LEVEL SECURITY;
