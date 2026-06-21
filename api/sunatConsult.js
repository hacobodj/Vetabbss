'use strict';
const { isAuthenticated } = require('./_lib/auth');
const { sendJson, getQuery } = require('./_lib/response');
const { scrapeSunatRuc } = require('./_lib/sunatScraper');

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return sendJson(res, 401, { ok: false, message: 'Sesión requerida.' });
  if (req.method !== 'GET')  return sendJson(res, 405, { ok: false, message: 'Método no permitido.' });

  const numero = String(getQuery(req, 'numero') || '').replace(/\D/g, '');
  if (numero.length !== 11) return sendJson(res, 400, { ok: false, message: 'RUC inválido.' });

  try {
    const data = await scrapeSunatRuc(numero);
    if (!data) return sendJson(res, 404, { ok: false, message: 'RUC no encontrado en SUNAT.' });
    return sendJson(res, 200, { ok: true, ...data });
  } catch (err) {
    return sendJson(res, 502, { ok: false, message: 'Error al consultar SUNAT.' });
  }
};
