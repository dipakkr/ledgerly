// ledgerly web app. Every page runs exactly the SQL files in src/queries/, nothing else,
// so the queries a migration rehearsal replays are the queries this UI depends on.
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { databaseUrl } from "./scripts/env.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const QUERIES = Object.fromEntries(
  readdirSync(join(ROOT, "src/queries")).filter((f) => f.endsWith(".sql"))
    .map((f) => [f.replace(/\.sql$/, ""), readFileSync(join(ROOT, "src/queries", f), "utf8")]),
);
const pool = new pg.Pool({ connectionString: databaseUrl(), max: 4 });
const port = Number(process.env.PORT ?? 8800);

async function run(name) {
  const t0 = Date.now();
  try {
    const r = await pool.query(QUERIES[name]);
    return { ok: true, rows: r.rows, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: e.message, ms: Date.now() - t0 };
  }
}

async function health() {
  try {
    const v = await pool.query("SELECT max(version) AS v FROM schema_migrations");
    return { ok: true, version: v.rows[0].v };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/overview") {
    const names = Object.keys(QUERIES);
    const results = await Promise.all(names.map(run));
    const body = { health: await health(), queries: Object.fromEntries(names.map((n, i) => [n, results[i]])) };
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    return res.end(JSON.stringify(body));
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(readFileSync(join(ROOT, "public/index.html")));
  }
  res.writeHead(404).end("not found");
}).listen(port, () => console.log(`ledgerly on http://localhost:${port}`));
