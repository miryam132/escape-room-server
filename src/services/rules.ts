import type { Hotspot } from "@prisma/client";
import { AppError } from "../errors.js";
export const normalizeAnswer = (v: string) =>
  v.normalize("NFKC").trim().toLowerCase();
export function validateGraph(items: Hotspot[]) {
  const byId = new Map(items.map((h) => [h.id, h]));
  if (items.filter((h) => h.isFinal).length > 1)
    throw new AppError(400, "INVALID_ROOM", "Only one final puzzle is allowed");
  for (const h of items) {
    if (
      h.type === "INFO" &&
      (h.isFinal ||
        h.prerequisiteId ||
        h.question ||
        h.answer ||
        h.answerType ||
        h.hint ||
        h.solvedContent ||
        h.lockedMessage)
    )
      throw new AppError(
        400,
        "INVALID_HOTSPOT",
        "Information points contain content only",
      );
    if (
      h.type === "PUZZLE" &&
      (!h.question || !h.answer || !h.answerType || !h.solvedContent)
    )
      throw new AppError(
        400,
        "INVALID_HOTSPOT",
        "A puzzle needs a question, answer type, answer and solved content",
      );
    if (h.answerType === "number" && h.answer && !/^\d+$/.test(h.answer))
      throw new AppError(
        400,
        "INVALID_ANSWER",
        "Numeric answers contain digits only",
      );
    if (h.prerequisiteId && !h.lockedMessage)
      throw new AppError(
        400,
        "INVALID_HOTSPOT",
        "A dependent puzzle needs a locked message",
      );
    const seen = new Set([h.id]);
    let next = h.prerequisiteId;
    while (next) {
      if (seen.has(next))
        throw new AppError(
          400,
          "CYCLIC_DEPENDENCY",
          "Puzzle dependencies cannot form a cycle",
        );
      seen.add(next);
      const parent = byId.get(next);
      if (!parent || parent.type !== "PUZZLE")
        throw new AppError(
          400,
          "INVALID_DEPENDENCY",
          "Prerequisite must be a puzzle in the same room",
        );
      if (parent.isFinal)
        throw new AppError(
          400,
          "INVALID_DEPENDENCY",
          "Nothing may depend on the final puzzle",
        );
      next = parent.prerequisiteId;
    }
  }
}
export function isPlayable(items: Hotspot[], imageUrl: string) {
  try {
    validateGraph(items);
    return (
      !!imageUrl &&
      items.filter((h) => h.isFinal && h.type === "PUZZLE").length === 1
    );
  } catch {
    return false;
  }
}
export function hotspotState(
  h: Hotspot,
  items: Hotspot[],
  solved: Set<string>,
): "LOCKED" | "AVAILABLE" | "SOLVED" {
  if (solved.has(h.id)) return "SOLVED";
  if (h.prerequisiteId && !solved.has(h.prerequisiteId)) return "LOCKED";
  if (
    h.isFinal &&
    items.some((p) => p.type === "PUZZLE" && !p.isFinal && !solved.has(p.id))
  )
    return "LOCKED";
  return "AVAILABLE";
}
export function publicHotspot(
  h: Hotspot,
  items: Hotspot[],
  solved: Set<string>,
) {
  const state = hotspotState(h, items, solved);
  const base = {
    id: h.id,
    roomId: h.roomId,
    label: h.label,
    xpercent: h.xpercent,
    ypercent: h.ypercent,
    type: h.type,
    isFinal: h.isFinal,
    state,
  };
  if (state === "LOCKED")
    return {
      ...base,
      lockedMessage: h.lockedMessage || "Solve the remaining puzzles first.",
    };
  if (state === "SOLVED") return { ...base, content: h.solvedContent };
  if (h.type === "INFO") return { ...base, content: h.content };
  return {
    ...base,
    content: h.content,
    question: h.question,
    answerType: h.answerType,
    hasHint: !!h.hint,
  };
}
