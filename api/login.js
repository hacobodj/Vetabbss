const { isPinValid, getSessionCookie } = require('./_lib/auth');
const { sendJson } = require('./_lib/response');

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Metodo no permitido.' });
  }

  try {
    const body = await readJsonBody(req);
    const pin = String(body.pin || '').trim();

    if (!isPinValid(pin)) {
      return sendJson(res, 401, { error: 'PIN incorrecto.' });
    }

    res.setHeader('Set-Cookie', getSessionCookie());
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 400, { error: 'Solicitud invalida.' });
  }
};
