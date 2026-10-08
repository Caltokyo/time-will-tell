// GET /api/config — public, non-secret settings for the page.

const { redisConfig, instagramUrl, send } = require("./_lib");

module.exports = function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return send(res, 405, { status: "error", code: "method_not_allowed" });
  }
  return send(
    res,
    200,
    { subscribeEnabled: Boolean(redisConfig()), instagramUrl: instagramUrl() },
    "public, max-age=0, s-maxage=300"
  );
};
