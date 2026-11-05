import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const persistTo = "/data";
const port = process.env.PORT || "8787";
const wrangler = `${root}/node_modules/wrangler/bin/wrangler.js`;
const config = `${root}/dist/server/wrangler.json`;
const workerEnv = {
  ...process.env,
  // Wrangler must explicitly expose the Node process environment to workerd.
  CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
};

mkdirSync(persistTo, { recursive: true });
// Both files are idempotent, so every boot can recover from an interrupted
// schema or seed step without relying on a marker file.
for (const file of ["drizzle/0000_luxuriant_otto_octavius.sql", "drizzle/0001_seed_entre_examples.sql"]) {
  const result = spawnSync(process.execPath, [
    "--import", "./scripts/sites-env.mjs", wrangler, "d1", "execute", "DB", "--local",
    "--config", config, "--persist-to", persistTo, "--file", file,
  ], { cwd: root, stdio: "inherit", env: workerEnv });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const result = spawnSync(process.execPath, [
  "--import", "./scripts/sites-env.mjs", wrangler, "dev", "--config", config,
  "--local", "--persist-to", persistTo, "--ip", "0.0.0.0", "--port", port, "--inspector-port", "0",
], { cwd: root, stdio: "inherit", env: workerEnv });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
