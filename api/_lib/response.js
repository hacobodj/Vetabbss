function setNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function sendJson(res, status, data) {
  setNoStore(res);
  if (typeof res.status === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function sendHtml(res, status, html) {
  setNoStore(res);
  if (typeof res.status === 'function') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(status).send(html);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function redirect(res, location) {
  setNoStore(res);
  res.writeHead(302, { Location: location });
  res.end();
}

function getQuery(req, name) {
  if (req.query && Object.prototype.hasOwnProperty.call(req.query, name)) {
    const value = req.query[name];
    return Array.isArray(value) ? value[0] : value;
  }
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get(name);
}

module.exports = { setNoStore, sendJson, sendHtml, redirect, getQuery };
