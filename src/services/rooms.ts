import { randomUUID } from "node:crypto";
import type { Prisma, Hotspot, Room } from "@prisma/client";
import { db, lockRoom } from "../db.js";
import { AppError } from "../errors.js";
import {
  roomSchema,
  roomPatchSchema,
  hotspotSchema,
  hotspotPatchSchema,
  listSchema,
} from "../schemas/index.js";
import { isPlayable, validateGraph } from "./rules.js";
export async function listRooms(query: unknown) {
  const q = listSchema.parse(query);
  const where: Prisma.RoomWhereInput = {
    ...(q.search
      ? {
          OR: [
            { title: { contains: q.search, mode: "insensitive" } },
            { description: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(q.category ? { category: q.category } : {}),
    ...(q.difficulty ? { difficulty: q.difficulty } : {}),
  };
  const orderBy: Prisma.RoomOrderByWithRelationInput =
    q.sort === "title"
      ? { title: "asc" }
      : q.sort === "difficulty"
        ? { difficulty: "asc" }
        : { createdAt: q.sort === "oldest" ? "asc" : "desc" };
  const [items, total] = await db.$transaction([
    db.room.findMany({
      where,
      orderBy: [orderBy, { id: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { hotspots: true },
    }),
    db.room.count({ where }),
  ]);
  return {
    items: items.map(summary),
    total,
    page: q.page,
    pageSize: q.pageSize,
  };
}
export function summary(r: Room & { hotspots: Hotspot[] }) {
  const { hotspots, imageKey, ...room } = r;
  return {
    ...room,
    puzzleCount: hotspots.filter((h) => h.type === "PUZZLE").length,
    isPlayable: isPlayable(hotspots, r.imageUrl),
  };
}
export async function getRoom(id: string, admin = false) {
  const r = await db.room.findUnique({
    where: { id },
    include: { hotspots: { orderBy: { id: "asc" } } },
  });
  if (!r) throw new AppError(404, "NOT_FOUND", "Room not found");
  return admin ? r : summary(r);
}
export async function createRoom(body: unknown) {
  return db.room.create({ data: roomSchema.parse(body) });
}
export async function editRoom(id: string, body: unknown) {
  const data = roomPatchSchema.parse(body);
  return db.$transaction(async (tx) => {
    const old = await lockRoom(tx, id);
    const reset = data.imageUrl !== undefined && data.imageUrl !== old.imageUrl;
    if (reset) await tx.gameProgress.deleteMany({ where: { roomId: id } });
    const room = await tx.room.update({
      where: { id },
      data: { ...data, ...(reset ? { revision: { increment: 1 } } : {}) },
    });
    return { room, progressReset: reset };
  });
}
export async function deleteRoom(id: string) {
  await db.$transaction(async (tx) => {
    await lockRoom(tx, id);
    await tx.hotspot.updateMany({
      where: { roomId: id },
      data: { prerequisiteId: null },
    });
    await tx.room.delete({ where: { id } });
  });
}
export async function saveHotspot(
  roomId: string,
  id: string | null,
  body: unknown,
) {
  const parsed = id
    ? hotspotPatchSchema.parse(body)
    : hotspotSchema.parse(body);
  return db.$transaction(async (tx) => {
    const room = await lockRoom(tx, roomId);
    const old = id ? room.hotspots.find((h) => h.id === id) : null;
    if (id && !old) throw new AppError(404, "NOT_FOUND", "Hotspot not found");
    const base = {
      id: id || randomUUID(),
      roomId,
      label: "",
      xpercent: 0,
      ypercent: 0,
      type: "INFO" as const,
      content: "",
      question: null,
      answerType: null,
      answer: null,
      hint: null,
      solvedContent: null,
      prerequisiteId: null,
      lockedMessage: null,
      isFinal: false,
    };
    const next = { ...base, ...old, ...parsed } as Hotspot;
    validateGraph([...room.hotspots.filter((h) => h.id !== next.id), next]);
    const { id: hid, roomId: rid, ...data } = next;
    const hotspot = old
      ? await tx.hotspot.update({ where: { id: hid }, data })
      : await tx.hotspot.create({ data: { ...data, id: hid, roomId: rid } });
    await tx.gameProgress.deleteMany({ where: { roomId } });
    const updated = await tx.room.update({
      where: { id: roomId },
      data: { revision: { increment: 1 } },
    });
    return { hotspot, progressReset: true, revision: updated.revision };
  });
}
export async function hotspotRoom(id: string) {
  const h = await db.hotspot.findUnique({
    where: { id },
    select: { roomId: true },
  });
  if (!h) throw new AppError(404, "NOT_FOUND", "Hotspot not found");
  return h.roomId;
}
export async function deleteHotspot(id: string) {
  const roomId = await hotspotRoom(id);
  await db.$transaction(async (tx) => {
    const room = await lockRoom(tx, roomId);
    if (room.hotspots.some((h) => h.prerequisiteId === id))
      throw new AppError(
        409,
        "HAS_DEPENDENTS",
        "Remove dependent links before deleting this puzzle",
      );
    await tx.hotspot.delete({ where: { id } });
    await tx.gameProgress.deleteMany({ where: { roomId } });
    await tx.room.update({
      where: { id: roomId },
      data: { revision: { increment: 1 } },
    });
  });
}
