const DEFAULT_DNI_API_URL = 'https://api.apis.net.pe/v1/dni';

function normalizeDni(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidDni(value) {
  return /^\d{8}$/.test(normalizeDni(value));
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeApiPayload(data, fallbackDni) {
  const payload = data && data.data ? data.data : data;
  if (!payload || typeof payload !== 'object') return null;

  const nombres = cleanText(payload.nombres);
  const apellidoPaterno = cleanText(payload.apellidoPaterno || payload.apellido_paterno);
  const apellidoMaterno = cleanText(payload.apellidoMaterno || payload.apellido_materno);
  const nombreCompleto = cleanText(
    payload.nombre ||
    payload.nombreCompleto ||
    payload.nombre_completo ||
    payload.razonSocial ||
    payload.razon_social ||
    [apellidoPaterno, apellidoMaterno, nombres].filter(Boolean).join(' ')
  );

  const nombre = nombreCompleto.toUpperCase();
  if (!nombre) return null;

  return {
    dni: payload.numeroDocumento || payload.dni || fallbackDni,
    nombre,
    nombres: nombres.toUpperCase(),
    apellidoPaterno: apellidoPaterno.toUpperCase(),
    apellidoMaterno: apellidoMaterno.toUpperCase(),
    source: 'apis.net.pe'
  };
}

async function lookupDni(value, options = {}) {
  const numero = normalizeDni(value);
  if (!isValidDni(numero)) {
    const error = new Error('DNI invalido. Debe tener 8 digitos.');
    error.statusCode = 400;
    throw error;
  }

  const apiUrl = options.apiUrl || process.env.DNI_API_URL || DEFAULT_DNI_API_URL;
  const url = `${apiUrl}?numero=${encodeURIComponent(numero)}`;
  const headers = { accept: 'application/json' };
  const token = options.apiToken || process.env.DNI_API_TOKEN || process.env.BBSS_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const error = new Error(`Consulta DNI fallo con HTTP ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  return normalizeApiPayload(data, numero);
}

module.exports = { lookupDni, normalizeDni, isValidDni, normalizeApiPayload };
