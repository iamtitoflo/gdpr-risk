'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');
const { scanUrl } = require('./scanner');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────
const DEFAULT_ALLOWED_ORIGINS = [
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowAllOrigins = process.env.CORS_ALLOW_ALL === 'true';

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS.'));
  },
}));
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Rate limiting simple (evitar abuso en MVP) ──────────────────────────────
const scanQueue = new Map(); // ip -> timestamp del último scan
const RATE_LIMIT_MS = 5000; // 5 segundos entre scans por IP
const RATE_LIMIT_TTL_MS = 60 * 60 * 1000;

function normalizeScanUrl(input) {
  const trimmed = input.trim();
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsedUrl = new URL(withProtocol);

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Solo se permiten URLs http o https.');
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('La URL no puede incluir credenciales.');
  }
  if (!parsedUrl.hostname) {
    throw new Error('La URL debe incluir un hostname válido.');
  }

  return parsedUrl;
}

function isPrivateIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('::ffff:127.') ||
      normalized.startsWith('::ffff:10.') ||
      normalized.startsWith('::ffff:192.168.')
    );
  }

  return true;
}

async function assertPublicUrl(parsedUrl) {
  const hostname = parsedUrl.hostname.toLowerCase();
  const blockedHosts = ['localhost', '0.0.0.0'];
  if (blockedHosts.includes(hostname) || hostname.endsWith('.local')) {
    throw new Error('No se pueden escanear URLs locales o privadas.');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('No se pueden escanear URLs locales o privadas.');
    }
    return;
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: false });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('No se pueden escanear URLs que resuelven a redes locales o privadas.');
  }
}

function cleanOldRateLimitEntries(now = Date.now()) {
  for (const [ip, timestamp] of scanQueue.entries()) {
    if (now - timestamp > RATE_LIMIT_TTL_MS) scanQueue.delete(ip);
  }
}

function normalizeOption(value, allowed, fallback) {
  const normalized = String(value || fallback).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function inferLanguageFromRequest(req) {
  const acceptLanguage = String(req.headers['accept-language'] || '').toLowerCase();
  if (acceptLanguage.startsWith('nl') || acceptLanguage.includes(',nl')) return 'nl';
  if (acceptLanguage.startsWith('es') || acceptLanguage.includes(',es')) return 'es';
  return 'en';
}

function inferMarketFromLanguage(language) {
  if (language === 'nl') return 'nl';
  if (language === 'es') return 'es';
  return 'eu';
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /scan - Escanear una URL
app.post('/scan', async (req, res) => {
  const { url } = req.body;
  const requestedLanguage = normalizeOption(req.body.reportLanguage, ['auto', 'es', 'en', 'nl'], 'auto');
  const requestedMarket = normalizeOption(req.body.market, ['auto', 'eu', 'es', 'nl'], 'auto');
  const reportLanguage = requestedLanguage === 'auto' ? inferLanguageFromRequest(req) : requestedLanguage;
  const market = requestedMarket === 'auto' ? inferMarketFromLanguage(reportLanguage) : requestedMarket;

  // Validar input
  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      error: 'Se requiere el campo "url" en el body de la petición.',
    });
  }

  const cleanUrl = url.trim();
  if (cleanUrl.length === 0) {
    return res.status(400).json({ error: 'La URL no puede estar vacía.' });
  }

  // Validar que sea una URL válida y pública
  let parsedUrl;
  try {
    parsedUrl = normalizeScanUrl(cleanUrl);
    await assertPublicUrl(parsedUrl);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'URL no válida. Ejemplo: https://example.com' });
  }

  // Rate limiting básico por IP
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  cleanOldRateLimitEntries();
  const lastScan = scanQueue.get(clientIp);
  if (lastScan && Date.now() - lastScan < RATE_LIMIT_MS) {
    const wait = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastScan)) / 1000);
    return res.status(429).json({
      error: `Demasiadas peticiones. Espera ${wait} segundo(s) antes de volver a escanear.`,
    });
  }
  scanQueue.set(clientIp, Date.now());

  const scanTarget = parsedUrl.href;
  console.log(`[${new Date().toISOString()}] Escaneando: ${scanTarget}`);

  try {
    const result = await scanUrl(scanTarget, { reportLanguage, market });
    console.log(`[${new Date().toISOString()}] Completado: ${scanTarget} → score ${result.score} (${result.riskLevel})`);
    res.json(result);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error escaneando ${scanTarget}:`, err.message);

    // Mensajes de error más amigables
    let userMessage = 'Error al escanear la URL.';
    if (err.message.includes('ERR_NAME_NOT_RESOLVED')) {
      userMessage = 'No se pudo resolver el dominio. Verifica que la URL sea correcta.';
    } else if (err.message.includes('ERR_CONNECTION_REFUSED')) {
      userMessage = 'Conexión rechazada. El servidor no responde.';
    } else if (err.message.includes('timeout')) {
      userMessage = 'La web tardó demasiado en responder (timeout). Inténtalo de nuevo.';
    } else if (err.message.includes('ERR_SSL')) {
      userMessage = 'Error de certificado SSL al acceder a la web.';
    }

    res.status(500).json({ error: userMessage, detail: err.message });
  }
});

// Fallback: servir index.html para cualquier ruta no encontrada
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║     Privacy Risk Scanner - MVP           ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  Servidor:  http://localhost:${PORT}         ║`);
  console.log('  ║  Endpoint:  POST /scan                   ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log('  Listo para escanear URLs. Abre el navegador.');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`  El puerto ${PORT} ya está en uso.`);
    console.error('  Cierra la otra instancia del servidor o arranca con otro puerto:');
    console.error('');
    console.error('    PowerShell:  $env:PORT=3001; npm start');
    console.error('    CMD:         set PORT=3001 && npm start');
    console.error('');
    process.exit(1);
  }
  throw err;
});
