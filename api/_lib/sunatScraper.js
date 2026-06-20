'use strict';
/**
 * Scraper SUNAT — Consulta RUC con reCAPTCHA v3 via Playwright.
 * En una sola sesión obtiene:
 *   - Datos del RUC: CIUU, razón social, domicilio, estado, condición
 *   - Representante Legal: tipo doc, N° documento, nombre, cargo, fecha
 */

const SUNAT_URL    = 'https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/FrameCriterioBusquedaWeb.jsp';
const TIMEOUT_NAV  = 25000;
const TIMEOUT_RES  = 18000;
const TIMEOUT_REP  = 12000;

function clean(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function stripTags(html) {
  return clean(String(html || '').replace(/<[^>]*>/g, ''));
}

function extractField(flat, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '.*?list-group-item-text"\\s*>\\s*([^<]{2,250})', 's');
  const m = flat.match(re);
  return m ? clean(m[1]) : '';
}

/* ── Parsear fecha peruana DD/MM/YYYY → timestamp ── */
function parseDatePe(str) {
  const p = (str || '').split('/');
  if (p.length !== 3) return 0;
  return new Date(+p[2], +p[1] - 1, +p[0]).getTime();
}

/* ── Parsear la página principal de resultado RUC ── */
function parseRucHtml(html) {
  const flat = html.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');

  // Actividades económicas: "Principal - 0729 - EXTRACCIÓN..."
  const actividades = [];
  const reAct = /(?:Principal|Secundaria)\s*-\s*(\d{4})\s*-\s*([^<]+)/gi;
  let m;
  while ((m = reAct.exec(flat)) !== null) {
    actividades.push({
      tipo: /^P/i.test(m[0].trim()) ? 'Principal' : 'Secundaria',
      codigo: m[1].trim(),
      descripcion: clean(m[2]),
    });
  }
  const principal = actividades.find(a => a.tipo === 'Principal') || actividades[0] || null;

  // Razón social desde encabezado: "20536126440 - MINERA VETA DORADA S.A.C."
  const rsM = flat.match(/Número de RUC.*?heading">\s*\d{11}\s*-\s*([^<]+)/i);
  const razonSocial = rsM ? clean(rsM[1]) : '';

  const domicilio  = extractField(flat, 'Domicilio Fiscal:');
  const estado     = extractField(flat, 'Estado del Contribuyente:').split(' ')[0];
  const condicion  = extractField(flat, 'Condición del Contribuyente:').split(' ')[0];
  const tipo       = extractField(flat, 'Tipo Contribuyente:');
  const inscripcion= extractField(flat, 'Fecha de Inscripción:');

  if (!principal) return null;

  return {
    ciuuCodigo:        principal.codigo,
    ciuuDescripcion:   principal.descripcion,
    actividadEconomica:`${principal.codigo} - ${principal.descripcion}`,
    actividades,
    razonSocial:       razonSocial  || undefined,
    domicilioFiscal:   domicilio    || undefined,
    estado:            estado       || undefined,
    condicion:         condicion    || undefined,
    tipoContribuyente: tipo         || undefined,
    fechaInscripcion:  inscripcion  || undefined,
  };
}

/* ── Parsear la página de Representantes Legales ── */
function parseRepresentantes(html) {
  const flat = html.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');
  const rows = [];

  // Extraer filas <tr> de la tabla (excluyendo thead)
  const reTr = /<tr[^>]*>(.*?)<\/tr>/gi;
  let mTr;
  while ((mTr = reTr.exec(flat)) !== null) {
    const cells = [];
    const reTd = /<td[^>]*>(.*?)<\/td>/gi;
    let mTd;
    while ((mTd = reTd.exec(mTr[1])) !== null) {
      cells.push(stripTags(mTd[1]));
    }
    // Filas válidas: [tipoDoc, nroDoc (numérico), nombre, cargo, fechaDesde]
    if (cells.length >= 5 && /^\d{6,}$/.test(cells[1])) {
      rows.push({
        tipoDoc:      cells[0],
        nroDocumento: cells[1],
        nombre:       cells[2],
        cargo:        cells[3],
        fechaDesde:   cells[4],
      });
    }
  }

  // Seleccionar mejor Representante Legal:
  // Prioridad: GERENTE GENERAL > TITULAR-GERENTE > DIRECTOR GERENTE > GERENTE > cualquier otro
  // Si hay varios del mismo tipo, tomar el de fecha más reciente
  const PRIORIDAD = ['GERENTE GENERAL','TITULAR GERENTE','TITULAR-GERENTE','DIRECTOR GERENTE','GERENTE'];
  let gerentesGenerales = [];
  for (const cargo of PRIORIDAD) {
    const found = rows.filter(r => r.cargo.toUpperCase().includes(cargo));
    if (found.length > 0) { gerentesGenerales = found; break; }
  }
  if (!gerentesGenerales.length) gerentesGenerales = rows; // último fallback: todos

  let representanteLegal = null;
  if (gerentesGenerales.length > 0) {
    gerentesGenerales.sort((a, b) => parseDatePe(b.fechaDesde) - parseDatePe(a.fechaDesde));
    representanteLegal = gerentesGenerales[0];
  } else if (rows.length > 0) {
    representanteLegal = rows[0];
  }

  return { representantes: rows, representanteLegal };
}

/* ── Lanzador de navegador: local (playwright) o serverless (@sparticuz/chromium) ── */
async function launchBrowser() {
  // Intentar primero con @sparticuz/chromium (compatible con Vercel/Lambda)
  try {
    const chromiumPkg = require('@sparticuz/chromium');
    const { chromium: pwCore } = require('playwright-core');
    return await pwCore.launch({
      args: chromiumPkg.args,
      executablePath: await chromiumPkg.executablePath(),
      headless: chromiumPkg.headless,
    });
  } catch (_) {
    // Fallback: playwright completo (entorno local / vercel dev)
    const { chromium } = require('playwright');
    return await chromium.launch({ headless: true });
  }
}

/* ── Scraper principal ── */
async function scrapeSunatRuc(numero) {
  let browser = null;
  try {
    browser = await launchBrowser();
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'es-PE',
    });
    const page = await ctx.newPage();

    // ── PASO 1: Buscar RUC (con reCAPTCHA v3) ──
    await page.goto(SUNAT_URL, { waitUntil: 'networkidle', timeout: TIMEOUT_NAV });
    await page.fill('#txtRuc', numero);
    await page.click('#btnAceptar');
    await page.waitForURL('**/jcrS00Alias**', { timeout: TIMEOUT_RES });
    await page.waitForLoadState('domcontentloaded');

    const rucHtml = await page.content();
    const data = parseRucHtml(rucHtml);
    if (!data) return null;

    // ── PASO 2: Obtener Representantes Legales ──
    // Patrón correcto: iniciar espera de navegación ANTES del submit
    try {
      const navPromise = page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT_REP
      });
      await page.evaluate(() => {
        const form = document.querySelector('form[name="formRepLeg"]');
        if (form) form.submit();
      });
      await navPromise;

      const repHtml = await page.content();
      const { representantes, representanteLegal } = parseRepresentantes(repHtml);

      data.representantes     = representantes;
      data.representanteLegal = representanteLegal || undefined;
    } catch (e) {
      // No es crítico — el scraper devuelve lo que tiene
      console.warn('[sunatScraper] Representantes no disponibles:', e.message);
    }

    return data;

  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { scrapeSunatRuc };
