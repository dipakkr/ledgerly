// npm run reset: rebuild ledgerly "prod" from scratch (migrations 0001-0006 + deterministic data).
// Same bytes every run: fixed PRNG seed, fixed clock, explicit ids. Landmines are documented in LANDMINES.md.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { databaseUrl } from "./env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = ["0001", "0002", "0003", "0004", "0005", "0006"];

export const COUNTS = {
  customers: 8000,
  merchants: 300,
  basePayments: 30000,
  orphanPayments: 37, // L2: customer_id 8001-8037, accounts deleted in the 2024 cleanup
  nullMerchant: 64, // L3: legacy POS integration never sent merchant_id
  duplicateCharges: 18, // L1: UPI retry bug charged the same transaction twice
  refundedDuplicates: 11, // of those 18 double charges, 11 were refunded on the duplicate copy
};

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260926);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const FIRST = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ishaan", "Kabir", "Rohan", "Ananya", "Diya", "Aadhya", "Saanvi", "Myra", "Isha", "Priya", "Kavya", "Meera", "Nisha", "Rahul", "Vikram", "Neha", "Pooja", "Karan", "Tanvi", "Siddharth", "Riya", "Manish", "Divya"];
const LAST = ["Sharma", "Verma", "Iyer", "Reddy", "Nair", "Menon", "Patel", "Shah", "Gupta", "Rao", "Kulkarni", "Joshi", "Das", "Bose", "Singh", "Kapoor", "Mehta", "Pillai", "Chopra", "Banerjee"];
const BANKS = ["okhdfcbank", "okicici", "oksbi", "okaxis", "ybl", "paytm", "ibl"];
const CITIES = ["Bengaluru", "Mumbai", "Delhi", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Kochi"];
const CATEGORIES = ["grocery", "restaurant", "pharmacy", "electronics", "fashion", "fuel", "travel", "education"];
const SHOPS = ["Kirana", "Cafe", "Medicals", "Mart", "Bazaar", "Foods", "Traders", "Store", "Express", "Hub"];

const T0 = Date.parse("2026-01-01T00:00:00Z");
const SPAN = Date.parse("2026-09-21T00:00:00Z") - T0;
const iso = (ms) => new Date(ms).toISOString();
const upiRef = (n) => `UPI${String(260000000000 + n * 7919).padStart(12, "0")}`;

function buildData() {
  const customers = [];
  for (let id = 1; id <= COUNTS.customers; id++) {
    const f = pick(FIRST), l = pick(LAST);
    const handle = `${f}.${l}${int(1, 999)}`.toLowerCase();
    const pan = `${String.fromCharCode(65 + int(0, 25))}${String.fromCharCode(65 + int(0, 25))}${String.fromCharCode(65 + int(0, 25))}P${l[0]}${int(1000, 9999)}${String.fromCharCode(65 + int(0, 25))}`;
    customers.push([id, `${f} ${l}`, `${handle}@${pick(["gmail.com", "yahoo.in", "outlook.com"])}`, `+91 9${int(100000000, 999999999)}`, `${handle}@${pick(BANKS)}`, pan, iso(T0 + Math.floor(rnd() * SPAN * 0.5))]);
  }
  const merchants = [];
  for (let id = 1; id <= COUNTS.merchants; id++) {
    const city = pick(CITIES);
    merchants.push([id, `${pick(LAST)} ${pick(SHOPS)}`, pick(CATEGORIES), city, iso(T0 - int(30, 900) * 86400e3)]);
  }

  // Base payments. Landmine rows are chosen from disjoint id ranges so the counts stay exact.
  const payments = [];
  const refunds = [];
  let refundId = 1;
  const nullMerchantIds = new Set();
  while (nullMerchantIds.size < COUNTS.nullMerchant) nullMerchantIds.add(int(1, 10000));
  for (let id = 1; id <= COUNTS.basePayments; id++) {
    const r = rnd();
    const status = r < 0.03 ? "failed" : r < 0.05 ? "refunded" : "captured";
    const amount = (int(2000, 450000) / 100).toFixed(2);
    const created = T0 + Math.floor((id / COUNTS.basePayments) * SPAN) + int(0, 3600e3);
    const merchant = nullMerchantIds.has(id) ? null : int(1, COUNTS.merchants);
    payments.push([id, int(1, COUNTS.customers), merchant, amount, status, upiRef(id), iso(created)]);
    if (status === "refunded" && id > 10000) {
      refunds.push([refundId++, id, amount, pick(["item not delivered", "customer request", "wrong amount"]), iso(created + int(1, 72) * 3600e3)]);
    }
  }
  let nextId = COUNTS.basePayments + 1;
  // L2: payments whose customer no longer exists (ids 8001-8037).
  for (let i = 0; i < COUNTS.orphanPayments; i++) {
    const created = T0 + int(0, 60) * 86400e3;
    payments.push([nextId, COUNTS.customers + 1 + i, int(1, COUNTS.merchants), (int(5000, 200000) / 100).toFixed(2), "captured", upiRef(nextId), iso(created)]);
    nextId++;
  }
  // L1: 18 double charges: a second payment with the SAME upi_txn_ref a few seconds after the original.
  // Originals come from ids 20001-29999 (captured, has merchant, not an orphan). 11 duplicates were refunded.
  const originals = [];
  while (originals.length < COUNTS.duplicateCharges) {
    const p = payments[int(20001, 29999) - 1];
    if (p[4] === "captured" && p[2] !== null && !originals.includes(p)) originals.push(p);
  }
  originals.sort((a, b) => a[0] - b[0]);
  originals.forEach((orig, i) => {
    const dupAt = Date.parse(orig[6]) + int(2, 9) * 1000;
    payments.push([nextId, orig[1], orig[2], orig[3], "captured", orig[5], iso(dupAt)]);
    if (i < COUNTS.refundedDuplicates) {
      refunds.push([refundId++, nextId, orig[3], "duplicate charge (UPI retry)", iso(dupAt + int(2, 30) * 3600e3)]);
    }
    nextId++;
  });
  return { customers, merchants, payments, refunds };
}

async function insertRows(client, table, columns, rows) {
  for (let i = 0; i < rows.length; i += 2000) {
    const chunk = rows.slice(i, i + 2000);
    const params = [];
    const tuples = chunk.map((row) => `(${row.map((v) => { params.push(v); return `$${params.length}`; }).join(",")})`);
    await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES ${tuples.join(",")}`, params);
  }
  await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT max(id) FROM ${table}))`);
}

export async function reset(url = databaseUrl()) {
  const t0 = Date.now();
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS pgwarden CASCADE;");
    const files = readdirSync(join(ROOT, "migrations")).filter((f) => BASELINE.includes(f.slice(0, 4))).sort();
    for (const f of files) {
      await client.query(readFileSync(join(ROOT, "migrations", f), "utf8"));
      if (f.slice(0, 4) !== "0001") await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [f.slice(0, 4)]);
    }
    await client.query("INSERT INTO schema_migrations (version) VALUES ('0001')");
    const d = buildData();
    await client.query("BEGIN");
    await insertRows(client, "customers", ["id", "full_name", "email", "phone", "upi_id", "pan", "created_at"], d.customers);
    await insertRows(client, "merchants", ["id", "name", "category", "city", "created_at"], d.merchants);
    await insertRows(client, "payments", ["id", "customer_id", "merchant_id", "amount", "status", "upi_txn_ref", "created_at"], d.payments);
    await insertRows(client, "refunds", ["id", "payment_id", "amount", "reason", "created_at"], d.refunds);
    await client.query("COMMIT");
    await client.query("ANALYZE");
    const facts = await prodFacts(client);
    return { ms: Date.now() - t0, facts };
  } finally {
    await client.end();
  }
}

export async function prodFacts(client) {
  const one = async (sql) => Object.values((await client.query(sql)).rows[0])[0];
  return {
    customers: Number(await one("SELECT count(*) FROM customers")),
    merchants: Number(await one("SELECT count(*) FROM merchants")),
    payments: Number(await one("SELECT count(*) FROM payments")),
    refunds: Number(await one("SELECT count(*) FROM refunds")),
    duplicate_txn_refs: Number(await one("SELECT count(*) FROM (SELECT upi_txn_ref FROM payments GROUP BY 1 HAVING count(*) > 1) d")),
    orphan_payments: Number(await one("SELECT count(*) FROM payments p WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = p.customer_id)")),
    null_merchant: Number(await one("SELECT count(*) FROM payments WHERE merchant_id IS NULL")),
    refunded_total: String(await one("SELECT coalesce(sum(amount),0) FROM refunds")),
    last_version: await one("SELECT max(version) FROM schema_migrations"),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { ms, facts } = await reset();
  console.log(JSON.stringify(facts));
  console.log(`✓ ledgerly prod reset in ${(ms / 1000).toFixed(1)}s`);
}
