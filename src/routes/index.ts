import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import * as c from "../controllers/index.js";
export const router = Router();
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many authentication attempts. Try later.",
    },
  },
});
router.post("/auth/register", authLimit, c.register);
router.post("/auth/login", authLimit, c.login);
router.use(authenticate);
router.get("/auth/me", c.me);
router.get("/rooms", c.listRooms);
router.get("/rooms/:id", c.roomDetails);
router.post("/rooms/:id/game", c.start);
router.get("/rooms/:id/game", c.state);
router.get("/rooms/:id/game/hotspots/:hotspotId", c.open);
router.get("/rooms/:id/game/hotspots/:hotspotId/hint", c.hint);
router.post("/rooms/:id/game/hotspots/:hotspotId/answer", c.answer);
router.post("/rooms/:id/game/restart", c.restart);
router.use("/admin", requireAdmin);
router.post(
  "/admin/uploads",
  rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many uploads" } },
  }),
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  }).single("image"),
  c.upload,
);
router.post("/admin/rooms", c.createRoom);
router.get("/admin/rooms/:id", c.adminDetails);
router.patch("/admin/rooms/:id", c.editRoom);
router.delete("/admin/rooms/:id", c.deleteRoom);
router.post("/admin/rooms/:id/hotspots", c.addHotspot);
router.patch("/admin/hotspots/:id", c.editHotspot);
router.delete("/admin/hotspots/:id", c.deleteHotspot);
