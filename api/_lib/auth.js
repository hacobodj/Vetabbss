const crypto = require('crypto');

const COOKIE_NAME = 'portal_bbss_access';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getPin() {
  return process.env.BBSS_PIN || process.env.BBSS_ACCESS_PIN || 'vetadoradaBBSS';
}

function getSecret() {
  return process.env.BBSS_SESSION_SECRET || 'portal-bbss-default-session-secret-change-me';
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(String(value)).digest('hex');
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join('='));
    return acc;
  }, {});
}

function buildCookieValue(expiresAt) {
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return false;

  const [expiresAt, signature] = token.split('.');
  if (!expiresAt || !signature) return false;
  if (Number.isNaN(Number(expiresAt))) return false;
  if (Number(expiresAt) <= Date.now()) return false;
  return safeEqual(signature, sign(expiresAt));
}

function isPinValid(pin) {
  return safeEqual(String(pin || '').trim(), getPin());
}

function getSessionCookie() {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const value = buildCookieValue(expiresAt);
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS};${secure}`;
}

function getLogoutCookie() {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0;${secure}`;
}

module.exports = {
  COOKIE_NAME,
  getPin,
  getSessionCookie,
  getLogoutCookie,
  isAuthenticated,
  isPinValid
};
