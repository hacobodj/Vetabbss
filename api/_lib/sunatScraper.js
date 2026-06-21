'use strict';
// Consulta SUNAT via https nativo (evita WAF que bloquea fetch/undici).
// Token de reCAPTCHA: el script sunatrecaptcha3.js de SUNAT genera un string
// aleatorio de 52 chars — no hay validación real de Google.
// Respuesta leída como latin1 porque SUNAT mezcla bytes ISO-8859-1 en los datos.

const https = require('https');
const qs    = require('querystring');

const BASE        = 'https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc';
const SEARCH_URL  = BASE + '/FrameCriterioBusquedaWeb.jsp';
const ACTION_PATH = '/cl-ti-itmrconsruc/jcrS00Alias';
const HOST        = 'e-consultaruc.sunat.gob.pe';
const UA          = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function readLatin1(res) {
  return new Promise((ok, err) => {
    const c = [];
    res.on('data', d => c.push(d));
    res.on('end',  () => ok(Buffer.concat(c).toString('latin1')));
    res.on('error', err);
  });
}

function httpsGet(url) {
  return new Promise((ok, err) => {
    const r = https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'es-PE,es;q=0.9' } }, res => {
      const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      readLatin1(res).then(body => ok({ cookies, body })).catch(err);
    });
    r.on('error', err); r.end();
  });
}

function httpsPost(path, cookies, data) {
  const payload = qs.stringify(data);
  return new Promise((ok, err) => {
    const r = https.request({
      hostname: HOST, path, method: 'POST',
      headers: {
        'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'es-PE,es;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
        'Referer': SEARCH_URL, 'Cookie': cookies,
      },
    }, res => { readLatin1(res).then(body => ok({ body })).catch(err); });
    r.on('error', err); r.write(payload); r.end();
  });
}

function fakeToken() {
  let k = '';
  while (k.length < 52) k += Math.random().toString(36).substring(2);
  return k.substring(0, 52);
}

function htmlDecode(s) {
  return String(s || '')
    .replace(/&aacute;/gi,'á').replace(/&eacute;/gi,'é').replace(/&iacute;/gi,'í')
    .replace(/&oacute;/gi,'ó').replace(/&uacute;/gi,'ú').replace(/&Aacute;/gi,'Á')
    .replace(/&Eacute;/gi,'É').replace(/&Iacute;/gi,'Í').replace(/&Oacute;/gi,'Ó')
    .replace(/&Uacute;/gi,'Ú').replace(/&ntilde;/gi,'ñ').replace(/&Ntilde;/gi,'Ñ')
    .replace(/&uuml;/gi,'ü').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>').replace(/&quot;/gi,'"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function clean(s)     { return String(s || '').replace(/\s+/g, ' ').trim(); }
function stripTags(h) { return clean(htmlDecode(String(h || '').replace(/<[^>]*>/g, ''))); }

function extractField(flat, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = flat.match(new RegExp(esc + '.*?list-group-item-text"\\s*>\\s*([^<]{2,250})', 's'));
  return m ? clean(m[1]) : '';
}

function parseRucHtml(html) {
  const flat = htmlDecode(html).replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');
  const actividades = [];
  const reAct = /(?:Principal|Secundaria)\s*-\s*(\d{4})\s*-\s*([^<]+)/gi;
  let m;
  while ((m = reAct.exec(flat)) !== null)
    actividades.push({ tipo: /^P/i.test(m[0].trim()) ? 'Principal' : 'Secundaria', codigo: m[1].trim(), descripcion: clean(m[2]) });
  const principal = actividades.find(a => a.tipo === 'Principal') || actividades[0] || null;
  if (!principal) return null;

  const rsM = flat.match(/Número de RUC.*?heading">\s*\d{11}\s*-\s*([^<]+)/i);
  return {
    ciuuCodigo        : principal.codigo,
    ciuuDescripcion   : principal.descripcion,
    actividadEconomica: `${principal.codigo} - ${principal.descripcion}`,
    actividades,
    razonSocial       : rsM ? clean(rsM[1]) : undefined,
    domicilioFiscal   : extractField(flat, 'Domicilio Fiscal:')              || undefined,
    estado            : extractField(flat, 'Estado del Contribuyente:').split(' ')[0] || undefined,
    condicion         : extractField(flat, 'Condición del Contribuyente:').split(' ')[0] || undefined,
    tipoContribuyente : extractField(flat, 'Tipo Contribuyente:')             || undefined,
    fechaInscripcion  : extractField(flat, 'Fecha de Inscripción:')           || undefined,
  };
}

function parseDatePe(s) {
  const p = (s || '').split('/');
  return p.length === 3 ? new Date(+p[2], +p[1]-1, +p[0]).getTime() : 0;
}

function parseRepresentantes(html) {
  const flat = htmlDecode(html).replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');
  const rows = [];
  const reTr = /<tr[^>]*>(.*?)<\/tr>/gi;
  let mTr;
  while ((mTr = reTr.exec(flat)) !== null) {
    const cells = [];
    const reTd = /<td[^>]*>(.*?)<\/td>/gi;
    let mTd;
    while ((mTd = reTd.exec(mTr[1])) !== null) cells.push(stripTags(mTd[1]));
    if (cells.length >= 5 && /^\d{6,}$/.test(cells[1]))
      rows.push({ tipoDoc: cells[0], nroDocumento: cells[1], nombre: cells[2], cargo: cells[3], fechaDesde: cells[4] });
  }
  const PRIO = ['GERENTE GENERAL','TITULAR GERENTE','TITULAR-GERENTE','DIRECTOR GERENTE','GERENTE'];
  let best = [];
  for (const p of PRIO) { best = rows.filter(r => r.cargo.toUpperCase().includes(p)); if (best.length) break; }
  if (!best.length) best = [...rows];
  best.sort((a, b) => parseDatePe(b.fechaDesde) - parseDatePe(a.fechaDesde));
  return { representantes: rows, representanteLegal: best[0] || null };
}

async function scrapeSunatRuc(numero) {
  const { cookies } = await httpsGet(SEARCH_URL);
  const { body: rucHtml } = await httpsPost(ACTION_PATH, cookies, {
    accion: 'consPorRuc', razSoc: '', nroRuc: numero, nrodoc: '',
    token: fakeToken(), contexto: 'ti-it', modo: '1',
    search1: numero, search2: '', search3: '',
  });
  const data = parseRucHtml(rucHtml);
  if (!data) return null;
  try {
    const { body: repHtml } = await httpsPost(ACTION_PATH, cookies, {
      accion: 'getRepLeg', contexto: 'ti-it', modo: '1',
      desRuc: data.razonSocial || '', nroRuc: numero,
    });
    const { representantes, representanteLegal } = parseRepresentantes(repHtml);
    data.representantes     = representantes;
    data.representanteLegal = representanteLegal || undefined;
  } catch (_) {}
  return data;
}

module.exports = { scrapeSunatRuc };
