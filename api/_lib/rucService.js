const DEFAULT_RUC_API_URL = 'https://api.apis.net.pe/v1/ruc';

function normalizeRuc(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidRuc(value) {
  return /^\d{11}$/.test(normalizeRuc(value));
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeApiPayload(data, fallbackRuc) {
  const payload = data && data.data ? data.data : data;
  if (!payload || typeof payload !== 'object') return null;

  const razonSocial = cleanText(payload.nombre || payload.razonSocial || payload.razon_social).toUpperCase();
  if (!razonSocial) return null;

  return {
    ruc: payload.numeroDocumento || payload.ruc || fallbackRuc,
    razonSocial,
    estado: cleanText(payload.estado).toUpperCase(),
    condicion: cleanText(payload.condicion).toUpperCase(),
    direccion: cleanText(payload.direccion),
    source: 'apis.net.pe'
  };
}

async function lookupRuc(value, options = {}) {
  const numero = normalizeRuc(value);
  if (!isValidRuc(numero)) {
    const error = new Error('RUC invalido. Debe tener 11 digitos.');
    error.statusCode = 400;
    throw error;
  }

  const apiUrl = options.apiUrl || process.env.RUC_API_URL || DEFAULT_RUC_API_URL;
  const url = `${apiUrl}?numero=${encodeURIComponent(numero)}`;
  const headers = { accept: 'application/json' };

  const token = options.apiToken || process.env.RUC_API_TOKEN || process.env.BBSS_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const error = new Error(`Consulta RUC fallo con HTTP ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  return normalizeApiPayload(data, numero);
}

module.exports = { lookupRuc, normalizeRuc, isValidRuc, normalizeApiPayload };
