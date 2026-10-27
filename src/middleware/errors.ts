import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import multer from "multer";
import { AppError } from "../errors.js";
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    });
    return;
  }
  if (err instanceof AppError) {
    res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof multer.MulterError) {
    res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: {
        code: err.code,
        message: "Upload rejected: one image, maximum 5 MB",
      },
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const status =
      err.code === "P2025"
        ? 404
        : ["P2002", "P2003", "P2014"].includes(err.code)
          ? 409
          : 500;
    res.status(status).json({
      error: {
        code:
          status === 409
            ? "CONFLICT"
            : status === 404
              ? "NOT_FOUND"
              : "DATABASE_ERROR",
        message:
          status === 409
            ? "The record conflicts with existing data"
            : status === 404
              ? "Record not found"
              : "Database operation failed",
      },
    });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res
      .status(400)
      .json({ error: { code: "INVALID_JSON", message: "Malformed JSON" } });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({
      error: { code: "TOO_LARGE", message: "Request body is too large" },
    });
    return;
  }
  console.error(
    "Request failed:",
    err instanceof Error ? err.name : "UnknownError",
  );
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
};
