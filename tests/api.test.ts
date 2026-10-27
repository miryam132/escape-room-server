import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
const storage = vi.hoisted(() => ({
  upload: vi.fn().mockResolvedValue({ error: null }),
  getPublicUrl: vi
    .fn()
    .mockReturnValue({ data: { publicUrl: "https://example.com/test.webp" } }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from: () => storage } }),
}));
let app: Express,
  db: PrismaClient,
  pg: PGlite | undefined,
  socket: PGLiteSocketServer | undefined,
  dir: string | undefined;
let admin: string,
  player: string,
  other: string,
  room: string,
  info: string,
  first: string,
  second: string,
  final: string,
  revision: number;
const secret = "test-only-secret-not-for-deployment-123456789";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const puzzle = (label: string, extra = {}) => ({
  label,
  type: "PUZZLE",
  xpercent: 50,
  ypercent: 50,
  content: "Puzzle content",
  question: "Enter code",
  answerType: "number",
  answer: "1234",
  solvedContent: "Secret revealed",
  ...extra,
});
beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = secret;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-storage-mocked";
  process.env.TRUST_PROXY = "0";
  process.env.CORS_ORIGINS = "http://localhost:5173";
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    if (url.searchParams.get("schema") !== "escape_room_test")
      throw new Error(
        "Use an isolated database with schema=escape_room_test. Tests delete its data.",
      );
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  } else {
    dir = await mkdtemp(path.join(tmpdir(), "escape-pg-"));
    pg = await PGlite.create(dir);
    socket = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: 55439 });
    await socket.start();
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:55439/postgres?schema=escape_room_test&connection_limit=1";
  }
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  await promisify(execFile)(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: process.env, timeout: 60000 },
  );
  ({ db } = await import("../src/db.js"));
  ({ app } = await import("../src/app.js"));
  await db.hotspot.updateMany({ data: { prerequisiteId: null } });
  await db.room.deleteMany();
  await db.user.deleteMany();
  const a = await db.user.create({
    data: {
      name: "Admin",
      email: "admin@test.invalid",
      role: "ADMIN",
      passwordHash: await bcrypt.hash("Testing-password-123", 12),
    },
  });
  admin = jwt.sign({}, secret, {
    subject: a.id,
    expiresIn: "2h",
    issuer: "escape-room-server",
    audience: "escape-room-client",
  });
});
afterAll(async () => {
  await db?.$disconnect();
  await socket?.stop();
  await pg?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});
describe.sequential("API with SQL migrations and Prisma", () => {
  it("health and OpenAPI validate", async () => {
    expect((await request(app).get("/api/health")).status).toBe(200);
    await SwaggerParser.validate(
      JSON.parse(await readFile("docs/openapi.json", "utf8")),
    );
    expect((await request(app).get("/api-docs/")).status).toBe(200);
  });
  it("registers PLAYER only; hashes passwords", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Player",
      email: "PLAYER@test.invalid",
      password: "Testing-password-123",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("PLAYER");
    expect(res.body).not.toHaveProperty("passwordHash");
    player = res.body.token;
    const user = await db.user.findUniqueOrThrow({
      where: { email: "player@test.invalid" },
    });
    expect(
      await bcrypt.compare("Testing-password-123", user.passwordHash),
    ).toBe(true);
    expect(user.passwordHash).not.toBe("Testing-password-123");
  });
  it("rejects role injection and duplicate registration", async () => {
    expect(
      (
        await request(app).post("/api/auth/register").send({
          name: "Evil",
          email: "evil@test.invalid",
          password: "Testing-password-123",
          role: "ADMIN",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app).post("/api/auth/register").send({
          name: "Player",
          email: "player@test.invalid",
          password: "Testing-password-123",
        })
      ).status,
    ).toBe(409);
  });
  it("handles valid and invalid login", async () => {
    expect(
      (
        await request(app).post("/api/auth/login").send({
          email: "player@test.invalid",
          password: "Testing-password-123",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app).post("/api/auth/login").send({
          email: "player@test.invalid",
          password: "Wrong-password-123",
        })
      ).status,
    ).toBe(401);
  });
  it("rejects missing, invalid, expired and wrong-audience tokens", async () => {
    expect((await request(app).get("/api/rooms")).status).toBe(401);
    expect(
      (await request(app).get("/api/rooms").set(auth("invalid"))).status,
    ).toBe(401);
    const id = (await db.user.findFirstOrThrow()).id;
    for (const token of [
      jwt.sign({}, secret, {
        subject: id,
        expiresIn: -10,
        issuer: "escape-room-server",
        audience: "escape-room-client",
      }),
      jwt.sign({}, secret, {
        subject: id,
        expiresIn: "1h",
        issuer: "escape-room-server",
        audience: "wrong",
      }),
    ])
      expect(
        (await request(app).get("/api/rooms").set(auth(token))).status,
      ).toBe(401);
  });
  it("enforces ADMIN role on every management route", async () => {
    for (const [method, url] of [
      ["post", "/api/admin/rooms"],
      ["post", "/api/admin/uploads"],
      ["patch", "/api/admin/hotspots/invalid"],
      ["delete", "/api/admin/rooms/invalid"],
      ["get", "/api/admin/rooms/invalid"],
    ]) {
      const res = await (request(app) as any)[method](url).set(auth(player));
      expect(res.status).toBe(403);
    }
  });
  it("rejects invalid room input and creates room", async () => {
    expect(
      (
        await request(app)
          .post("/api/admin/rooms")
          .set(auth(admin))
          .send({ title: "" })
      ).status,
    ).toBe(400);
    const res = await request(app)
      .post("/api/admin/rooms")
      .set(auth(admin))
      .send({
        title: "Detective office",
        description: "Find evidence",
        category: "Mystery",
        difficulty: "medium",
        imageUrl: "https://example.com/room.webp",
      });
    expect(res.status).toBe(201);
    room = res.body.id;
    expect(
      (await request(app).post(`/api/rooms/${room}/game`).set(auth(player)))
        .status,
    ).toBe(409);
  });
  it("creates generic information and puzzles", async () => {
    let res = await request(app)
      .post(`/api/admin/rooms/${room}/hotspots`)
      .set(auth(admin))
      .send({
        label: "Letter",
        type: "INFO",
        xpercent: 10,
        ypercent: 20,
        content: "Read me",
      });
    expect(res.status).toBe(201);
    info = res.body.hotspot.id;
    res = await request(app)
      .post(`/api/admin/rooms/${room}/hotspots`)
      .set(auth(admin))
      .send(puzzle("First", { hint: "A hint" }));
    expect(res.status).toBe(201);
    first = res.body.hotspot.id;
    res = await request(app)
      .post(`/api/admin/rooms/${room}/hotspots`)
      .set(auth(admin))
      .send(
        puzzle("Second", {
          answer: "24",
          prerequisiteId: first,
          lockedMessage: "Locked drawer",
        }),
      );
    expect(res.status).toBe(201);
    second = res.body.hotspot.id;
    res = await request(app)
      .post(`/api/admin/rooms/${room}/hotspots`)
      .set(auth(admin))
      .send(
        puzzle("Final", {
          answer: "241234",
          isFinal: true,
          prerequisiteId: second,
          lockedMessage: "Find all clues",
        }),
      );
    expect(res.status).toBe(201);
    final = res.body.hotspot.id;
    revision = res.body.revision;
  });
  it("rejects cycles, self-links, invalid coordinates and multiple finals", async () => {
    expect(
      (
        await request(app)
          .patch(`/api/admin/hotspots/${first}`)
          .set(auth(admin))
          .send({ prerequisiteId: second, lockedMessage: "Cycle" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch(`/api/admin/hotspots/${first}`)
          .set(auth(admin))
          .send({ prerequisiteId: first, lockedMessage: "Self" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch(`/api/admin/hotspots/${first}`)
          .set(auth(admin))
          .send({ xpercent: 101 })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`/api/admin/rooms/${room}/hotspots`)
          .set(auth(admin))
          .send(puzzle("Final2", { isFinal: true }))
      ).status,
    ).toBe(400);
  });
  it("rejects dependencies from another room", async () => {
    const r = await db.room.create({
      data: {
        title: "Other",
        description: "Other",
        category: "Other",
        difficulty: "hard",
        imageUrl: "https://example.com/other.png",
      },
    });
    const h = await db.hotspot.create({
      data: {
        roomId: r.id,
        ...puzzle("foreign"),
        type: "PUZZLE",
        answerType: "number",
      },
    });
    expect(
      (
        await request(app)
          .patch(`/api/admin/hotspots/${first}`)
          .set(auth(admin))
          .send({ prerequisiteId: h.id, lockedMessage: "Foreign" })
      ).status,
    ).toBe(400);
    await db.room.delete({ where: { id: r.id } });
  });
  it("a partial edit preserves final flag and nullable puzzle fields", async () => {
    const res = await request(app)
      .patch(`/api/admin/hotspots/${final}`)
      .set(auth(admin))
      .send({ hint: "Final hint updated" });
    expect(res.status).toBe(200);
    expect(res.body.hotspot.isFinal).toBe(true);
    expect(res.body.hotspot.answer).toBe("241234");
    revision = res.body.revision;
  });
  it("lists and filters without leaking answers", async () => {
    const res = await request(app)
      .get(
        "/api/rooms?search=detective&category=Mystery&difficulty=medium&sort=title",
      )
      .set(auth(player));
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].isPlayable).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("1234");
    expect(
      (await request(app).get("/api/rooms?search=missing").set(auth(player)))
        .body.total,
    ).toBe(0);
    expect(
      (await request(app).get("/api/rooms?pageSize=999").set(auth(player)))
        .status,
    ).toBe(400);
  });
  it("starts game, exposes info, conceals locked content and answers", async () => {
    const res = await request(app)
      .post(`/api/rooms/${room}/game`)
      .set(auth(player));
    expect(res.status).toBe(200);
    expect(res.body.totalPuzzles).toBe(3);
    expect(res.body.solvedCount).toBe(0);
    expect(res.body.hotspots.find((h: any) => h.id === second).state).toBe(
      "LOCKED",
    );
    expect(
      (
        await request(app)
          .get(`/api/rooms/${room}/game/hotspots/${info}`)
          .set(auth(player))
      ).body.content,
    ).toBe("Read me");
    const locked = await request(app)
      .get(`/api/rooms/${room}/game/hotspots/${second}`)
      .set(auth(player));
    expect(locked.body.lockedMessage).toBe("Locked drawer");
    expect(locked.body).not.toHaveProperty("question");
    expect(locked.body).not.toHaveProperty("content");
    const opened = await request(app)
      .get(`/api/rooms/${room}/game/hotspots/${first}`)
      .set(auth(player));
    expect(opened.body).not.toHaveProperty("answer");
    expect(opened.body).not.toHaveProperty("solvedContent");
    expect(opened.body).not.toHaveProperty("hint");
  });
  it("rejects locked answers and locked hints", async () => {
    expect(
      (
        await request(app)
          .post(`/api/rooms/${room}/game/hotspots/${second}/answer`)
          .set(auth(player))
          .send({ answer: "24", revision })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .get(`/api/rooms/${room}/game/hotspots/${second}/hint`)
          .set(auth(player))
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .get(`/api/rooms/${room}/game/hotspots/${first}/hint`)
          .set(auth(player))
      ).body.hint,
    ).toBe("A hint");
  });
  it("checks incorrect answers without progress and rejects empty answers", async () => {
    expect(
      (
        await request(app)
          .post(`/api/rooms/${room}/game/hotspots/${first}/answer`)
          .set(auth(player))
          .send({ answer: "9999", revision })
      ).body.correct,
    ).toBe(false);
    expect(
      (
        await request(app)
          .post(`/api/rooms/${room}/game/hotspots/${first}/answer`)
          .set(auth(player))
          .send({ answer: " ", revision })
      ).status,
    ).toBe(400);
  });
  it("solves, resumes and makes repeat submissions idempotent", async () => {
    const url = `/api/rooms/${room}/game/hotspots/${first}/answer`;
    const solved = await request(app)
      .post(url)
      .set(auth(player))
      .send({ answer: " 1234 ", revision });
    expect(solved.body.correct).toBe(true);
    expect(solved.body.game.solvedCount).toBe(1);
    expect(solved.body.hotspot.content).toBe("Secret revealed");
    expect(
      (
        await request(app)
          .post(url)
          .set(auth(player))
          .send({ answer: "1234", revision })
      ).body.alreadySolved,
    ).toBe(true);
    expect(
      (await request(app).post(`/api/rooms/${room}/game`).set(auth(player)))
        .body.solvedCount,
    ).toBe(1);
  });
  it("isolates progress between users", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Other",
      email: "other@test.invalid",
      password: "Testing-password-123",
    });
    other = reg.body.token;
    expect(
      (await request(app).post(`/api/rooms/${room}/game`).set(auth(other))).body
        .solvedCount,
    ).toBe(0);
    expect(
      (
        await request(app)
          .get(`/api/rooms/${room}/game/hotspots/${second}`)
          .set(auth(other))
      ).body.state,
    ).toBe("LOCKED");
  });
  it("completes only after prerequisites and persists completion", async () => {
    expect(
      (
        await request(app)
          .post(`/api/rooms/${room}/game/hotspots/${final}/answer`)
          .set(auth(player))
          .send({ answer: "241234", revision })
      ).status,
    ).toBe(409);
    await request(app)
      .post(`/api/rooms/${room}/game/hotspots/${second}/answer`)
      .set(auth(player))
      .send({ answer: "24", revision });
    const res = await request(app)
      .post(`/api/rooms/${room}/game/hotspots/${final}/answer`)
      .set(auth(player))
      .send({ answer: "241234", revision });
    expect(res.body.game.status).toBe("COMPLETED");
    expect(res.body.game.solvedCount).toBe(3);
    expect(
      (await request(app).get(`/api/rooms/${room}/game`).set(auth(player))).body
        .status,
    ).toBe("COMPLETED");
  });
  it("restarts only current player", async () => {
    const res = await request(app)
      .post(`/api/rooms/${room}/game/restart`)
      .set(auth(player))
      .send({ revision });
    expect(res.body.solvedCount).toBe(0);
    expect(res.body.status).toBe("ACTIVE");
    expect(await db.gameProgress.count()).toBe(2);
  });
  it("preserves progress for metadata edits and resets for puzzle edits", async () => {
    await request(app)
      .post(`/api/rooms/${room}/game/hotspots/${first}/answer`)
      .set(auth(player))
      .send({ answer: "1234", revision });
    expect(
      (
        await request(app)
          .patch(`/api/admin/rooms/${room}`)
          .set(auth(admin))
          .send({ title: "Updated title" })
      ).body.progressReset,
    ).toBe(false);
    expect(
      (await request(app).get(`/api/rooms/${room}/game`).set(auth(player))).body
        .solvedCount,
    ).toBe(1);
    const edit = await request(app)
      .patch(`/api/admin/hotspots/${first}`)
      .set(auth(admin))
      .send({ hint: "Updated hint" });
    expect(edit.body.progressReset).toBe(true);
    expect(await db.gameProgress.count()).toBe(0);
    expect(
      (
        await request(app)
          .post(`/api/rooms/${room}/game/hotspots/${first}/answer`)
          .set(auth(player))
          .send({ answer: "1234", revision })
      ).body.error.code,
    ).toBe("ROOM_CHANGED");
    revision = edit.body.revision;
  });
  it("uploads real decoded image using a mocked storage transport", async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#987654" },
    })
      .png()
      .toBuffer();
    const res = await request(app)
      .post("/api/admin/uploads")
      .set(auth(admin))
      .attach("image", png, "room.png");
    expect(res.status).toBe(201);
    expect(res.body.imageKey).toMatch(/.webp$/);
    expect(storage.upload).toHaveBeenCalled();
    expect(
      (await sharp(storage.upload.mock.calls.at(-1)![1]).metadata()).format,
    ).toBe("webp");
  });
  it("rejects fake and oversized image uploads", async () => {
    expect(
      (
        await request(app)
          .post("/api/admin/uploads")
          .set(auth(admin))
          .attach("image", Buffer.from("<script>alert(1)</script>"), "fake.png")
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/admin/uploads")
          .set(auth(admin))
          .attach("image", Buffer.alloc(5 * 1024 * 1024 + 1), "big.png")
      ).status,
    ).toBe(413);
  });
  it("reports storage failure without leaking details", async () => {
    storage.upload.mockResolvedValueOnce({
      error: { message: "secret internal detail" },
    });
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer();
    const res = await request(app)
      .post("/api/admin/uploads")
      .set(auth(admin))
      .attach("image", png, "room.png");
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("secret internal");
  });
  it("handles CORS, invalid JSON, UUIDs and unknown routes", async () => {
    expect(
      (
        await request(app)
          .get("/api/rooms")
          .set(auth(player))
          .set("Origin", "https://evil.example")
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get("/api/rooms")
          .set(auth(player))
          .set("Origin", "http://localhost:5173")
      ).headers["access-control-allow-origin"],
    ).toBe("http://localhost:5173");
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .set("Content-Type", "application/json")
          .send("{")
      ).status,
    ).toBe(400);
    expect(
      (await request(app).get("/api/rooms/not-a-uuid").set(auth(player)))
        .status,
    ).toBe(400);
    expect((await request(app).get("/unknown")).status).toBe(404);
  });
  it("protects dependency deletion and cascades room removal", async () => {
    expect(
      (
        await request(app)
          .delete(`/api/admin/hotspots/${first}`)
          .set(auth(admin))
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .delete(`/api/admin/hotspots/${info}`)
          .set(auth(admin))
      ).status,
    ).toBe(204);
    await request(app).post(`/api/rooms/${room}/game`).set(auth(player));
    expect(
      (await request(app).delete(`/api/admin/rooms/${room}`).set(auth(admin)))
        .status,
    ).toBe(204);
    expect(await db.hotspot.count()).toBe(0);
    expect(await db.gameProgress.count()).toBe(0);
    expect(
      (await request(app).get(`/api/rooms/${room}`).set(auth(player))).status,
    ).toBe(404);
  });
  it("seeds repeatably and creates an admin without overwriting accounts", async () => {
    const run = async (file: string, extra: Record<string, string> = {}) => {
      await db.$disconnect();
      if (pg) await pg.exec("DEALLOCATE ALL");
      return promisify(execFile)(process.execPath, ["--import", "tsx", file], {
        env: { ...process.env, ...extra },
        timeout: 30000,
      }).finally(async () => {
        if (pg) await pg.exec("DEALLOCATE ALL");
      });
    };
    await run("prisma/seed.ts", {
      DEMO_PLAYER_EMAIL: "demo@test.invalid",
      DEMO_PLAYER_PASSWORD: "Testing-demo-password-123",
    });
    expect(await db.room.count()).toBe(3);
    expect(await db.hotspot.count()).toBe(11);
    await run("prisma/seed.ts");
    expect(await db.room.count()).toBe(3);
    const demo = await db.room.findUniqueOrThrow({
      where: { id: "10000000-0000-4000-8000-000000000001" },
      include: { hotspots: true },
    });
    expect(demo.hotspots.filter((h) => h.type === "PUZZLE")).toHaveLength(4);
    await run("prisma/create-admin.ts", {
      ADMIN_NAME: "Owner",
      ADMIN_EMAIL: "owner@test.invalid",
      ADMIN_PASSWORD: "Owner-password-for-tests-123",
    });
    expect(
      (
        await db.user.findUniqueOrThrow({
          where: { email: "owner@test.invalid" },
        })
      ).role,
    ).toBe("ADMIN");
    await expect(
      run("prisma/create-admin.ts", {
        ADMIN_NAME: "Attempt",
        ADMIN_EMAIL: "player@test.invalid",
        ADMIN_PASSWORD: "Other-password-123",
      }),
    ).rejects.toThrow();
    expect(
      (
        await db.user.findUniqueOrThrow({
          where: { email: "player@test.invalid" },
        })
      ).role,
    ).toBe("PLAYER");
  });
  it("runs the standalone HTTP server and shuts down gracefully", async () => {
    await db.$disconnect();
    if (pg) await pg.exec("DEALLOCATE ALL");
    const { spawn } = await import("node:child_process");
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "src/server.ts"],
      {
        env: { ...process.env, PORT: "55521" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const exited = new Promise<number | null>((resolve) =>
      child.once("exit", resolve),
    );
    let output = "";
    child.stdout.on("data", (c) => {
      output += c.toString();
    });
    try {
      for (let i = 0; i < 80 && !output.includes("listening"); i++)
        await new Promise((r) => setTimeout(r, 100));
      expect(output).toContain("listening on port 55521");
      const health = await fetch("http://127.0.0.1:55521/api/health");
      expect(health.status).toBe(200);
      const docs = await fetch("http://127.0.0.1:55521/api-docs/");
      expect(docs.status).toBe(200);
    } finally {
      child.kill("SIGTERM");
      expect(await exited).toBe(0);
    }
  });
});
