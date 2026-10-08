// GET /api/config — public, non-secret settings for the page.

const { databaseUrl, instagramUrl, send } = require("./_lib");
const { resendKey } = require("./_email");

module.exports = function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return send(res, 405, { status: "error", code: "method_not_allowed" });
  }
  return send(
    res,
    200,
    { subscribeEnabled: Boolean(databaseUrl() && resendKey()), instagramUrl: instagramUrl() },
    "public, max-age=0, s-maxage=300"
  );
};
