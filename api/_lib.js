// Shared helpers for the Vercel serverless functions in /api.
// Files starting with "_" are not exposed as endpoints.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Neon PostgreSQL. Use the pooled connection string from the Neon console.
function databaseUrl() {
  const url = (process.env.DATABASE_URL || "").trim();
  return /^postgres(ql)?:\/\//.test(url) ? url : null;
}

let pool = null;
let schemaReady = null;

function db() {
  const url = databaseUrl();
  if (!url) throw new Error("storage_not_configured");
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 });
    pool.on("error", () => { pool = null; schemaReady = null; });
  }
  return pool;
}

// Create the TWT tables once per function instance (IF NOT EXISTS — idempotent).
async function ensureSchema() {
  const p = db();
  if (!schemaReady) {
    const sql = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
    schemaReady = p.query(sql).catch((err) => { schemaReady = null; throw err; });
  }
  await schemaReady;
  return p;
}

async function query(text, params) {
  const p = await ensureSchema();
  return p.query(text, params);
}

// Run fn(client) inside a transaction; rolls back if fn throws.
async function transaction(fn) {
  const p = await ensureSchema();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Absolute site origin for links in emails. SITE_URL wins; otherwise the request host.
function siteOrigin(req) {
  const env = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (/^https:\/\/[^/]+$/.test(env)) return env;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return `${local ? "http" : "https"}://${host}`;
}

// Only a real https Instagram profile URL is ever published.
function instagramUrl() {
  const raw = (process.env.INSTAGRAM_URL || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const okHost = u.hostname === "instagram.com" || u.hostname === "www.instagram.com";
    if (u.protocol !== "https:" || !okHost || u.pathname.length < 2) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function send(res, status, body, cache = "no-store") {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4096) throw new Error("body_too_large");
  }
  return raw ? JSON.parse(raw) : {};
}

function clientIpHash(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = fwd || (req.socket && req.socket.remoteAddress) || "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

module.exports = { databaseUrl, query, transaction, siteOrigin, instagramUrl, send, readJson, clientIpHash };
