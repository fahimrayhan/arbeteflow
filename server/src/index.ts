import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDb, ensureIndexes } from "./db.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start() {
  await ensureIndexes();

  const server = createApp().listen(config.port, () => {
    console.log(`JobFinder backend running at http://localhost:${config.port}`);
  });

  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`${signal} received, shutting down…`);

    // Force exit if open streams keep the server alive for too long.
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();

    server.close(() => {
      closeDb()
        .catch((error) => console.error("Error while closing MongoDB:", error))
        .finally(() => process.exit(0));
    });
    server.closeIdleConnections();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("Could not start server:", error);
  process.exit(1);
});
