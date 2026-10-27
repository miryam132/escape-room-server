import { PrismaClient, Prisma } from "@prisma/client";
export const db = new PrismaClient();
export type Tx = Prisma.TransactionClient;
// All operations affecting a room/game take the same row lock. This serializes
// edits, answers, resets and deletion, preventing progress from racing edits.
export async function lockRoom(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "Room" WHERE id=${id}::uuid FOR UPDATE`;
  if (!rows.length) throw new AppError(404, "NOT_FOUND", "Room not found");
  return tx.room.findUniqueOrThrow({
    where: { id },
    include: { hotspots: true },
  });
}
import { AppError } from "./errors.js";
