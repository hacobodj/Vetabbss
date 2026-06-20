const { getLogoutCookie } = require('./_lib/auth');
const { sendJson } = require('./_lib/response');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Metodo no permitido.' });
  }

  res.setHeader('Set-Cookie', getLogoutCookie());
  return sendJson(res, 200, { ok: true });
};
