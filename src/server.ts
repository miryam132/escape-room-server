import { app } from "./app.js";
import { env } from "./config/env.js";
import { db } from "./db.js";
await db.$connect();
const server = app.listen(env.PORT, "0.0.0.0", () =>
  console.log(`Escape Room API listening on port ${env.PORT}`),
);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(async () => {
    await db.$disconnect();
    clearTimeout(timeout);
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
