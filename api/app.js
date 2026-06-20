const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('./_lib/auth');
const { sendHtml, redirect } = require('./_lib/response');

const APP_FILE = path.join(__dirname, '_private_files', 'app.html');

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return redirect(res, '/');

  try {
    const html = fs.readFileSync(APP_FILE, 'utf8');
    return sendHtml(res, 200, html);
  } catch (error) {
    return sendHtml(res, 500, 'No se pudo cargar el portal protegido.');
  }
};
