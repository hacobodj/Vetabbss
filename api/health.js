const { sendJson } = require('./_lib/response');

module.exports = async (_req, res) => {
  return sendJson(res, 200, {
    ok: true,
    app: 'PortalBBSS',
    deployment: 'vercel',
    auth: 'pin-cookie-httpOnly'
  });
};
