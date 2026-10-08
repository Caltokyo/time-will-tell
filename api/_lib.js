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
async function query(text, params) {
  const p = db();
  if (!schemaReady) {
    const sql = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
    schemaReady = p.query(sql).catch((err) => { schemaReady = null; throw err; });
  }
  await schemaReady;
  return p.query(text, params);
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

module.exports = { databaseUrl, query, instagramUrl, send, readJson, clientIpHash };
