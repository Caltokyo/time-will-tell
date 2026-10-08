// Shared helpers for the Vercel serverless functions in /api.
// Files starting with "_" are not exposed as endpoints.

const crypto = require("crypto");

// Upstash Redis (REST). Vercel's Upstash integration sets KV_REST_API_*;
// a manually created Upstash database uses UPSTASH_REDIS_REST_*.
function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

async function redis(commands) {
  const cfg = redisConfig();
  if (!cfg) throw new Error("storage_not_configured");
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`storage_http_${res.status}`);
  const out = await res.json();
  for (const r of out) if (r && r.error) throw new Error("storage_command_failed");
  return out.map((r) => r.result);
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

module.exports = { redisConfig, redis, instagramUrl, send, readJson, clientIpHash };
