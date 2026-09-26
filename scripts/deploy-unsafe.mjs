// npm run deploy:unsafe -- <migration.sql>
// How many teams deploy: run each statement against prod as it comes, no rehearsal, no transaction
// around the whole file. Statements that succeed stay applied even when a later one fails.
import { readFileSync } from "node:fs";
import pg from "pg";
import { databaseUrl } from "./env.mjs";
import { prodFacts } from "./reset.mjs";

const file = process.argv[2];
if (!file) { console.error("usage: npm run deploy:unsafe -- <migration.sql>"); process.exit(2); }
const sql = readFileSync(file, "utf8").replace(/^\s*--.*$/gm, "");
const statements = sql.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);

const client = new pg.Client({ connectionString: databaseUrl() });
await client.connect();
const before = await prodFacts(client);
let failed = false;
for (const [i, s] of statements.entries()) {
  const label = s.replace(/\s+/g, " ").slice(0, 90);
  try {
    const r = await client.query(s);
    console.log(`✓ ${i + 1}/${statements.length} ${label}${r.rowCount ? `  (${r.rowCount} rows)` : ""}`);
  } catch (e) {
    console.log(`✗ ${i + 1}/${statements.length} ${label}\n    ${e.message}`);
    failed = true;
    break;
  }
}
const after = await prodFacts(client);
await client.end();
console.log("\nprod before → after");
for (const k of Object.keys(before)) if (before[k] !== after[k]) console.log(`  ${k}: ${before[k]} → ${after[k]}`);
console.log(failed ? "\n✗ deploy crashed half-way; everything above the failure is already live in prod." : "\n✓ deployed");
process.exit(failed ? 1 : 0);
