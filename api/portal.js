const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('./_lib/auth');
const { sendHtml, redirect, getQuery } = require('./_lib/response');

const FILES = {
  proveedor: 'Proveedor_BBSS.html',
  logistica: 'Logistica_BBSS.html',
  compliance: 'Compliance_BBSS.html'
};

function addSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https://www.vetadorada.pe https://vetadorada.vercel.app https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com data: blob:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:; " +
    "img-src 'self' https://www.vetadorada.pe https://vetadorada.vercel.app data: blob:; " +
    "media-src 'self' data: blob:; " +
    "connect-src 'self'; " +
    "frame-src 'self' data: blob:;"
  );
}

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return redirect(res, '/');

  const view = String(getQuery(req, 'view') || '').toLowerCase();
  const file = FILES[view];
  if (!file) return sendHtml(res, 404, 'Vista no encontrada.');

  try {
    const html = fs.readFileSync(path.join(__dirname, '_private_files', file), 'utf8');
    addSecurityHeaders(res);
    return sendHtml(res, 200, html);
  } catch (error) {
    return sendHtml(res, 500, 'No se pudo cargar la vista protegida.');
  }
};
