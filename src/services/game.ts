import { db, lockRoom, type Tx } from "../db.js";
import type { Hotspot, Room } from "@prisma/client";
import { AppError } from "../errors.js";
import {
  hotspotState,
  isPlayable,
  normalizeAnswer,
  publicHotspot,
} from "./rules.js";
type RoomData = Room & { hotspots: Hotspot[] };
function requirePlayable(room: RoomData) {
  if (!isPlayable(room.hotspots, room.imageUrl))
    throw new AppError(409, "ROOM_NOT_READY", "This room is not ready to play");
}
async function progress(tx: Tx, userId: string, roomId: string) {
  const p = await tx.gameProgress.findUnique({
    where: { userId_roomId: { userId, roomId } },
    include: { solved: true },
  });
  if (!p)
    throw new AppError(
      409,
      "GAME_NOT_STARTED",
      "Start or resume the room first; progress may have been reset after an edit",
    );
  return p;
}
async function state(tx: Tx, userId: string, room: RoomData) {
  const p = await progress(tx, userId, room.id);
  const solved = new Set(p.solved.map((s) => s.hotspotId));
  return {
    id: p.id,
    roomId: room.id,
    revision: room.revision,
    status: p.status,
    startedAt: p.startedAt,
    completedAt: p.completedAt,
    solvedHotspotIds: [...solved],
    solvedCount: solved.size,
    totalPuzzles: room.hotspots.filter((h) => h.type === "PUZZLE").length,
    hotspots: room.hotspots.map((h) => ({
      id: h.id,
      label: h.label,
      xpercent: h.xpercent,
      ypercent: h.ypercent,
      type: h.type,
      isFinal: h.isFinal,
      state: hotspotState(h, room.hotspots, solved),
    })),
  };
}
export async function start(userId: string, roomId: string) {
  return db.$transaction(async (tx) => {
    const room = await lockRoom(tx, roomId);
    requirePlayable(room);
    await tx.gameProgress.upsert({
      where: { userId_roomId: { userId, roomId } },
      create: { userId, roomId, revision: room.revision },
      update: {},
    });
    return state(tx, userId, room);
  });
}
export async function getState(userId: string, roomId: string) {
  return db.$transaction(async (tx) => {
    const room = await lockRoom(tx, roomId);
    return state(tx, userId, room);
  });
}
export async function open(
  userId: string,
  roomId: string,
  hotspotId: string,
  hint = false,
) {
  return db.$transaction(async (tx) => {
    const room = await lockRoom(tx, roomId);
    const p = await progress(tx, userId, roomId);
    const h = room.hotspots.find((v) => v.id === hotspotId);
    if (!h)
      throw new AppError(404, "NOT_FOUND", "Hotspot not found in this room");
    const solved = new Set(p.solved.map((v) => v.hotspotId));
    if (hint) {
      if (
        h.type !== "PUZZLE" ||
        hotspotState(h, room.hotspots, solved) === "LOCKED"
      )
        throw new AppError(409, "HINT_UNAVAILABLE", "Hint is not available");
      return { hint: h.hint };
    }
    return publicHotspot(h, room.hotspots, solved);
  });
}
export async function answer(
  userId: string,
  roomId: string,
  hotspotId: string,
  value: string,
  revision: number,
) {
  return db.$transaction(async (tx) => {
    const room = await lockRoom(tx, roomId);
    requirePlayable(room);
    if (revision !== room.revision)
      throw new AppError(
        409,
        "ROOM_CHANGED",
        "Room changed. Reload and start again.",
      );
    const p = await progress(tx, userId, roomId);
    const h = room.hotspots.find((v) => v.id === hotspotId);
    if (!h || h.type !== "PUZZLE")
      throw new AppError(404, "NOT_FOUND", "Puzzle not found");
    const solved = new Set(p.solved.map((v) => v.hotspotId));
    const current = hotspotState(h, room.hotspots, solved);
    if (current === "LOCKED")
      throw new AppError(
        409,
        "PUZZLE_LOCKED",
        "Solve the prerequisite puzzles first",
      );
    if (current === "SOLVED")
      return {
        correct: true,
        alreadySolved: true,
        hotspot: publicHotspot(h, room.hotspots, solved),
        game: await state(tx, userId, room),
      };
    if (p.status === "COMPLETED")
      throw new AppError(409, "GAME_COMPLETED", "Restart to play again");
    if (normalizeAnswer(value) !== normalizeAnswer(h.answer!))
      return { correct: false, message: "Incorrect answer. Try again." };
    await tx.solvedHotspot.create({
      data: { progressId: p.id, hotspotId: h.id },
    });
    await tx.gameProgress.update({
      where: { id: p.id },
      data: {
        updatedAt: new Date(),
        ...(h.isFinal ? { status: "COMPLETED", completedAt: new Date() } : {}),
      },
    });
    solved.add(h.id);
    return {
      correct: true,
      alreadySolved: false,
      hotspot: publicHotspot(h, room.hotspots, solved),
      game: await state(tx, userId, room),
    };
  });
}
export async function restart(
  userId: string,
  roomId: string,
  revision: number,
) {
  return db.$transaction(async (tx) => {
    const room = await lockRoom(tx, roomId);
    requirePlayable(room);
    if (revision !== room.revision)
      throw new AppError(409, "ROOM_CHANGED", "Reload the room first");
    await tx.gameProgress.deleteMany({ where: { userId, roomId } });
    await tx.gameProgress.create({
      data: { userId, roomId, revision: room.revision },
    });
    return state(tx, userId, room);
  });
}
