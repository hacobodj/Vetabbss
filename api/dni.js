const { isAuthenticated } = require('./_lib/auth');
const { lookupDni } = require('./_lib/dniService');
const { sendJson, getQuery } = require('./_lib/response');

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return sendJson(res, 401, { ok: false, message: 'Sesion requerida.' });
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, message: 'Metodo no permitido.' });

  const numero = getQuery(req, 'numero') || '';
  try {
    const result = await lookupDni(numero);
    if (!result) return sendJson(res, 404, { ok: false, message: 'DNI no encontrado.' });
    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { ok: false, message: error.message || 'Error al consultar DNI.' });
  }
};
