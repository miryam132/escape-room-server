import type { RequestHandler } from "express";
import * as auth from "../services/auth.js";
import * as rooms from "../services/rooms.js";
import * as game from "../services/game.js";
import { uploadImage } from "../services/uploads.js";
import {
  idSchema,
  registerSchema,
  loginSchema,
  answerSchema,
  revisionSchema,
} from "../schemas/index.js";
const param = (v: unknown) => idSchema.parse(v);
export const register: RequestHandler = async (req, res) => {
  res.status(201).json(await auth.register(registerSchema.parse(req.body)));
};
export const login: RequestHandler = async (req, res) => {
  res.json(await auth.login(loginSchema.parse(req.body)));
};
export const me: RequestHandler = (_req, res) => {
  res.json(res.locals.user);
};
export const listRooms: RequestHandler = async (req, res) => {
  res.json(await rooms.listRooms(req.query));
};
export const roomDetails: RequestHandler = async (req, res) => {
  res.json(await rooms.getRoom(param(req.params.id)));
};
export const adminDetails: RequestHandler = async (req, res) => {
  res.json(await rooms.getRoom(param(req.params.id), true));
};
export const createRoom: RequestHandler = async (req, res) => {
  res.status(201).json(await rooms.createRoom(req.body));
};
export const editRoom: RequestHandler = async (req, res) => {
  res.json(await rooms.editRoom(param(req.params.id), req.body));
};
export const deleteRoom: RequestHandler = async (req, res) => {
  await rooms.deleteRoom(param(req.params.id));
  res.sendStatus(204);
};
export const upload: RequestHandler = async (req, res) => {
  res.status(201).json(await uploadImage(req.file));
};
export const addHotspot: RequestHandler = async (req, res) => {
  res
    .status(201)
    .json(await rooms.saveHotspot(param(req.params.id), null, req.body));
};
export const editHotspot: RequestHandler = async (req, res) => {
  const id = param(req.params.id);
  res.json(await rooms.saveHotspot(await rooms.hotspotRoom(id), id, req.body));
};
export const deleteHotspot: RequestHandler = async (req, res) => {
  await rooms.deleteHotspot(param(req.params.id));
  res.sendStatus(204);
};
export const start: RequestHandler = async (req, res) => {
  res.json(await game.start(res.locals.user.id, param(req.params.id)));
};
export const state: RequestHandler = async (req, res) => {
  res.json(await game.getState(res.locals.user.id, param(req.params.id)));
};
export const open: RequestHandler = async (req, res) => {
  res.json(
    await game.open(
      res.locals.user.id,
      param(req.params.id),
      param(req.params.hotspotId),
    ),
  );
};
export const hint: RequestHandler = async (req, res) => {
  res.json(
    await game.open(
      res.locals.user.id,
      param(req.params.id),
      param(req.params.hotspotId),
      true,
    ),
  );
};
export const answer: RequestHandler = async (req, res) => {
  const body = answerSchema.parse(req.body);
  res.json(
    await game.answer(
      res.locals.user.id,
      param(req.params.id),
      param(req.params.hotspotId),
      body.answer,
      body.revision,
    ),
  );
};
export const restart: RequestHandler = async (req, res) => {
  const body = revisionSchema.parse(req.body);
  res.json(
    await game.restart(res.locals.user.id, param(req.params.id), body.revision),
  );
};
