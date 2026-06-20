'use strict';
/**
 * GET /api/sunat-ciuu?numero={RUC}
 *
 * Consulta SUNAT usando Playwright (reCAPTCHA v3 real).
 * Devuelve: ciuuCodigo, ciuuDescripcion, actividadEconomica,
 *           razonSocial, domicilioFiscal, estado, condicion.
 *
 * Requiere sesión autenticada.
 */
const { isAuthenticated } = require('./_lib/auth');
const { sendJson, getQuery } = require('./_lib/response');
const { scrapeSunatRuc } = require('./_lib/sunatScraper');

function normalizeRuc(v) {
  return String(v || '').replace(/\D/g, '');
}

module.exports = async (req, res) => {
  if (!isAuthenticated(req))
    return sendJson(res, 401, { ok: false, message: 'Sesión requerida.' });

  if (req.method !== 'GET')
    return sendJson(res, 405, { ok: false, message: 'Método no permitido.' });

  const numero = normalizeRuc(getQuery(req, 'numero') || '');
  if (numero.length !== 11)
    return sendJson(res, 400, { ok: false, message: 'RUC inválido. Debe tener 11 dígitos.' });

  try {
    const data = await scrapeSunatRuc(numero);

    if (!data)
      return sendJson(res, 404, { ok: false, message: 'RUC no encontrado o sin actividad económica en SUNAT.' });

    return sendJson(res, 200, { ok: true, ...data });

  } catch (err) {
    const msg = err?.message || 'Error al consultar SUNAT';
    console.error('[sunat-ciuu] Error:', msg);
    return sendJson(res, 502, { ok: false, message: 'No se pudo conectar con SUNAT. Intente nuevamente.' });
  }
};
