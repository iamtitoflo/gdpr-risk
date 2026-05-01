'use strict';

const { chromium } = require('playwright');
const dns = require('dns').promises;
const net = require('net');
const fs = require('fs').promises;
const path = require('path');

// ─── Clasificación de trackers por tipo ────────────────────────────────────

const TRACKER_MAP = {
  analytics: [
    'google-analytics.com', 'googletagmanager.com', 'hotjar.com', 'clarity.ms',
    'matomo.org', 'mixpanel.com', 'segment.com', 'amplitude.com',
    'scorecardresearch.com', 'quantserve.com',
  ],
  advertising: [
    'googleadservices.com', 'doubleclick.net', 'facebook.net', 'connect.facebook.net',
    'tiktok.com', 'snapchat.com', 'ads.linkedin.com', 'bat.bing.com',
    'criteo.com', 'outbrain.com', 'taboola.com', 'ads-twitter.com',
  ],
  social: [
    'twitter.com', 'x.com', 'linkedin.com',
  ],
  heatmaps: [
    'hotjar.com', 'clarity.ms',
  ],
  tagmanager: [
    'googletagmanager.com',
  ],
};

// Lista plana de todos los dominios tracker
const TRACKER_DOMAINS = [...new Set(Object.values(TRACKER_MAP).flat())];

// Proveedores fuera del EEE con probable transferencia internacional
const NON_EU_PROVIDERS = [
  'google-analytics.com', 'googletagmanager.com', 'googleadservices.com', 'doubleclick.net',
  'facebook.net', 'connect.facebook.net', 'tiktok.com', 'snapchat.com',
  'twitter.com', 'x.com', 'linkedin.com', 'ads.linkedin.com',
  'bing.com', 'bat.bing.com', 'hotjar.com', 'clarity.ms',
  'mixpanel.com', 'amplitude.com', 'segment.com',
];

const TRACKING_COOKIES = [
  '_ga', '_gid', '_fbp', '_gcl_au', '_tt_enable_cookie',
  'IDE', 'fr', 'MUID', 'NID', 'YSC', 'VISITOR_INFO1_LIVE',
  '_gads', '_gac_', 'DSID', 'FLC', 'AID', 'TAID', '_gcl_aw',
];

// Cookies de publicidad (subset más crítico)
const ADVERTISING_COOKIE_PATTERNS = ['_fbp', 'IDE', 'fr', 'DSID', 'FLC', 'AID', 'TAID', '_tt_'];

const CONSENT_KEYWORDS = {
  banner: ['cookies', 'cookie', 'cookiebeleid', 'cookie policy', 'política de cookies'],
  accept: ['aceptar', 'accept', 'accepteren', 'acceptar todo', 'accept all', 'alle accepteren', 'agree', 'i agree', 'i accept', 'akkoord'],
  reject: ['rechazar', 'reject', 'weigeren', 'rechazar todo', 'reject all', 'alle weigeren', 'decline', 'deny', 'no thanks', 'no, thanks', 'afwijzen'],
  manage: ['configurar', 'manage', 'instellingen', 'preferences', 'preferencias', 'voorkeuren', 'settings', 'customize', 'personalizar', 'manage cookies', 'cookie settings', 'aanpassen'],
};

// B-005: patrones de "seguir navegando = consentimiento"
const BROWSE_CONSENT_PATTERNS = [
  'al seguir navegando', 'si continúa navegando', 'al continuar navegando',
  'si continúa usando', 'al continuar usando', 'seguir usando el sitio',
  'by continuing to browse', 'by continuing to use', 'if you continue browsing',
  'continued use of', 'your continued use',
  'door verder te surfen', 'door gebruik te maken', 'als u verder bladert',
  'door verder te gaan', 'bij verder gebruik',
];

const PRIVACY_LINK_TEXTS = [
  'privacidad', 'política de privacidad', 'privacy', 'privacy policy',
  'gegevensbescherming', 'privacyverklaring', 'datenschutz', 'legal',
  'aviso legal', 'privacy notice', 'privacy statement',
];

const COOKIE_POLICY_TEXTS = [
  'cookies', 'política de cookies', 'cookie policy', 'cookiebeleid',
  'informatie over cookies', 'cookie notice', 'uso de cookies',
];

const REGULATORY_REFERENCE =
  'Referencia regulatoria orientativa: GDPR/ePrivacy y guías nacionales sobre cookies. Revisión legal recomendada.';

const TRACKER_CACHE_DIR = path.join(__dirname, '.cache');
const TRACKER_CACHE_FILE = path.join(TRACKER_CACHE_DIR, 'tracker-intel.json');
const TRACKER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function isTrackerDomain(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return TRACKER_DOMAINS.some(d => h === d || h.endsWith('.' + d));
  } catch { return false; }
}

function getTrackerDomain(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return url; }
}

function getTrackerType(domain) {
  for (const [type, list] of Object.entries(TRACKER_MAP)) {
    if (list.some(d => domain === d || domain.endsWith('.' + d))) return type;
  }
  return 'other';
}

function isTrackingCookie(name) {
  const n = name.toLowerCase();
  return TRACKING_COOKIES.some(tc => n === tc.toLowerCase() || n.startsWith(tc.toLowerCase()));
}

async function loadTrackerIntel() {
  const fallback = { domains: [], source: 'builtin', loaded: false };
  try {
    const cached = JSON.parse(await fs.readFile(TRACKER_CACHE_FILE, 'utf8'));
    if (Date.now() - cached.fetchedAt < TRACKER_CACHE_TTL_MS) {
      return { domains: cached.domains || [], source: 'cache', loaded: true };
    }
  } catch { /* cache miss */ }

  try {
    const [easyPrivacyRes, disconnectRes] = await Promise.all([
      fetch('https://easylist.to/easylist/easyprivacy.txt'),
      fetch('https://raw.githubusercontent.com/nicowillis/disconnect-me-tracker-list/main/services.json'),
    ]);
    const easyPrivacyText = easyPrivacyRes.ok ? await easyPrivacyRes.text() : '';
    const disconnectText = disconnectRes.ok ? await disconnectRes.text() : '{}';
    const domains = [
      ...parseEasyPrivacyDomains(easyPrivacyText),
      ...parseDisconnectDomains(disconnectText),
    ];
    const unique = [...new Set(domains)].filter(Boolean).slice(0, 50000);
    await fs.mkdir(TRACKER_CACHE_DIR, { recursive: true });
    await fs.writeFile(TRACKER_CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), domains: unique }, null, 2));
    return { domains: unique, source: 'network', loaded: true };
  } catch {
    return fallback;
  }
}

function parseEasyPrivacyDomains(text) {
  const domains = new Set();
  const domainPattern = /\|\|([a-z0-9.-]+\.[a-z]{2,})(?:[\^/]|$)/ig;
  let match;
  while ((match = domainPattern.exec(text || ''))) {
    const domain = match[1].replace(/^\*\./, '').toLowerCase();
    if (!domain.includes('*')) domains.add(domain);
  }
  return [...domains];
}

function parseDisconnectDomains(text) {
  const domains = new Set();
  try {
    const data = JSON.parse(text);
    const walk = value => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (!value || typeof value !== 'object') return;
      for (const [key, nested] of Object.entries(value)) {
        if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(key)) domains.add(key.toLowerCase());
        walk(nested);
      }
    };
    walk(data);
  } catch { /* invalid optional source */ }
  return [...domains];
}

function isExternalTrackerDomain(hostname, trackerIntel) {
  const h = String(hostname || '').toLowerCase();
  return (trackerIntel?.domains || []).some(d => h === d || h.endsWith('.' + d));
}

function isAdvertisingCookie(name) {
  const n = name.toLowerCase();
  return ADVERTISING_COOKIE_PATTERNS.some(p => n.startsWith(p.toLowerCase()));
}

function normalizeText(t) {
  return (t || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function containsKeyword(text, keywords) {
  const t = normalizeText(text);
  return keywords.some(kw => t.includes(kw.toLowerCase()));
}

function getUniqueDomains(requests) {
  const s = new Set();
  for (const r of requests) {
    try { s.add(new URL(r.url).hostname.toLowerCase()); } catch { /* skip */ }
  }
  return [...s];
}

function getBaseDomain(hostname) {
  const parts = (hostname || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');

  const lastTwo = parts.slice(-2).join('.');
  const publicSuffixLike = ['co.uk', 'com.au', 'com.br', 'com.mx', 'co.jp', 'co.nl'];
  if (publicSuffixLike.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

function getThirdPartyDomains(requests, pageUrl) {
  let firstPartyBase = '';
  try {
    firstPartyBase = getBaseDomain(new URL(pageUrl).hostname);
  } catch {
    return getUniqueDomains(requests);
  }

  return getUniqueDomains(requests).filter(domain => getBaseDomain(domain) !== firstPartyBase);
}

function getProviderNames(domains) {
  const providers = new Set();
  for (const domain of domains) {
    const d = String(domain || '').toLowerCase();
    if (d.includes('doubleclick') || d.includes('googleadservices') || d.includes('googletagmanager') || d.includes('google-analytics')) {
      providers.add('Google/DoubleClick');
    } else if (d.includes('linkedin')) {
      providers.add('LinkedIn');
    } else if (d.includes('facebook') || d.includes('meta')) {
      providers.add('Meta/Facebook');
    } else if (d.includes('tiktok')) {
      providers.add('TikTok');
    } else if (d.includes('hotjar')) {
      providers.add('Hotjar');
    } else if (d.includes('clarity.ms') || d.includes('bing.com')) {
      providers.add('Microsoft Clarity/Bing');
    } else if (d.includes('twitter') || d === 'x.com') {
      providers.add('X/Twitter');
    } else {
      providers.add(domain);
    }
  }
  return [...providers];
}

function getFindingGroup(finding) {
  const additionalIds = new Set(['C-010', 'T-001']);
  if (additionalIds.has(finding.checkId) || ['low', 'ok'].includes(finding.severity)) {
    return 'technical_observation';
  }
  return 'main_risk';
}

function getFindingName(finding) {
  return finding.title || finding.checkId;
}

function severityToApi(severity) {
  return String(severity || '').toUpperCase();
}

function confidenceToApi(confidence) {
  return String(confidence || '').toUpperCase();
}

function toStructuredEvidence(evidence) {
  if (Array.isArray(evidence)) {
    return evidence.map(item => typeof item === 'object' ? item : { value: item });
  }
  if (evidence && typeof evidence === 'object') return evidence;
  return evidence ? [{ value: evidence }] : [];
}

function cmpNameFromBanner(banner) {
  const evidence = (banner?.evidence || []).join(' ').toLowerCase();
  if (evidence.includes('cybotcookiebot') || evidence.includes('cookiebot')) return 'Cookiebot';
  if (evidence.includes('onetrust')) return 'OneTrust';
  if (evidence.includes('didomi')) return 'Didomi';
  if (evidence.includes('usercentrics')) return 'Usercentrics';
  if (banner?.hasBanner) return 'Detected';
  return 'None';
}

function requestEvidenceForDomains(requests, domains, limit = 6) {
  const list = [];
  for (const req of requests || []) {
    const host = req.hostname || getTrackerDomain(req.url);
    if (domains.some(d => host === d || host.endsWith('.' + d))) {
      list.push({
        request_url: req.url,
        domain: host,
        resource_type: req.type,
        timestamp_ms: req.timestampMs,
      });
    }
    if (list.length >= limit) break;
  }
  return list;
}

function buildApiReport(result) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of result.findings) {
    if (counts[f.severity] !== undefined) counts[f.severity]++;
  }

  return {
    url: result.url,
    scanned_at: result.scannedAt,
    score: result.score,
    risk_score: result.riskScore,
    band: severityToApi(result.band),
    disclaimer: result.disclaimer,
    summary: {
      total_findings: result.findings.length,
      critical: counts.critical,
      high: counts.high,
      medium: counts.medium,
      low: counts.low,
    },
    findings: result.findings.map(f => ({
      id: f.checkId,
      name: getFindingName(f),
      severity: severityToApi(f.severity),
      confidence: confidenceToApi(f.confidence),
      description: f.title,
      evidence: toStructuredEvidence(f.evidence),
      recommendation: f.recommendation,
      requires_human_review: f.requiresLegalReview || f.confidence === 'low',
    })),
    cookies_detected: result.meta.cookieDetails || result.meta.trackingCookiesFound || [],
    third_party_domains: result.meta.thirdPartyDomainsFound || [],
    cmp_detected: result.meta.cmpDetected || 'None',
    recommended_next_steps: result.recommendedNextSteps || [],
    limitations: result.scanLimitations,
  };
}

function calculateRiskScoring(findings) {
  const weights = { critical: 20, high: 10, medium: 5, low: 2, ok: 0 };
  const uniqueById = Object.values(findings.reduce((acc, f) => {
    const id = f.checkId;
    if (!id) return acc;
    if (!acc[id] || (weights[f.severity] || 0) > (weights[acc[id].severity] || 0)) {
      acc[id] = f;
    }
    return acc;
  }, {}));

  const hasNoBanner = uniqueById.some(f => f.checkId === 'B-001' && ['critical', 'high'].includes(f.severity));
  const hasCriticalTracker = uniqueById.some(f => ['C-002', 'C-005', 'C-006'].includes(f.checkId) && ['critical', 'high'].includes(f.severity));
  const bonus = hasNoBanner && hasCriticalTracker ? 30 : 0;
  const raw = uniqueById.reduce((sum, f) => sum + (weights[f.severity] || 0), 0) + bonus;
  const riskScore = Math.min(100, Math.round(raw / 1.5));
  const band = riskScore <= 19 ? 'low' : riskScore <= 49 ? 'medium' : riskScore <= 79 ? 'high' : 'critical';

  return {
    riskScore,
    band,
    uniqueFindings: uniqueById,
    total_findings: uniqueById.length,
    critical_count: uniqueById.filter(f => f.severity === 'critical').length,
    high_count: uniqueById.filter(f => f.severity === 'high').length,
  };
}

function normalizeScanUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Solo se permiten URLs http o https.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('La URL no puede incluir credenciales.');
  }
  return parsed.href;
}

function isPrivateIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
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
      normalized.startsWith('::ffff:172.') ||
      normalized.startsWith('::ffff:192.168.') ||
      normalized.startsWith('::ffff:169.254.')
    );
  }

  return true;
}

async function isSafePublicRequestUrl(requestUrl, cache) {
  let parsed;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return true;

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) return false;
  if (net.isIP(hostname)) return !isPrivateIp(hostname);
  if (cache.has(hostname)) return cache.get(hostname);

  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: false });
    const safe = addresses.length > 0 && addresses.every(({ address }) => !isPrivateIp(address));
    cache.set(hostname, safe);
    return safe;
  } catch {
    cache.set(hostname, false);
    return false;
  }
}

function resolveReportLanguage(language) {
  const normalized = String(language || 'es').toLowerCase();
  if (normalized.startsWith('nl')) return 'nl';
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('es')) return 'es';
  return 'es';
}

function resolveMarketProfile(market, reportLanguage) {
  const normalized = String(market || '').toLowerCase();
  let code = ['es', 'nl', 'eu'].includes(normalized) ? normalized : null;
  if (!code) {
    code = reportLanguage === 'nl' ? 'nl' : reportLanguage === 'es' ? 'es' : 'eu';
  }

  const profiles = {
    es: {
      code: 'es',
      label: 'España / AEPD',
      authorities: ['AEPD', 'EDPB', 'GDPR', 'ePrivacy', 'LSSI'],
      focus: 'Cookies, consentimiento en primera capa, botón Rechazar equivalente, transparencia por capas y formularios.',
    },
    nl: {
      code: 'nl',
      label: 'Netherlands regulatory profile: AP + ACM',
      authorities: ['Autoriteit Persoonsgegevens', 'ACM', 'EDPB', 'GDPR', 'Telecommunicatiewet'],
      focus: 'Tracking cookies, analítica privacy-friendly, consentimiento previo y facilidad real para rechazar.',
    },
    eu: {
      code: 'eu',
      label: 'UE general',
      authorities: ['EDPB', 'GDPR', 'ePrivacy'],
      focus: 'Riesgo técnico visible frente a criterios europeos comunes de consentimiento, transparencia y terceros.',
    },
  };

  return profiles[code];
}

function buildDocumentationDiscrepancy({ banner, privacy, trackers, trackingCookiesBefore }) {
  const hasDocumentation = privacy.hasPrivacyLink || privacy.hasCookiePolicyLink;
  const hasObservedTracking = trackers.length > 0 || trackingCookiesBefore.length > 0;
  if (!hasDocumentation || !hasObservedTracking || banner.hasBanner) return null;

  return {
    title: 'Posible discrepancia documentación vs implementación',
    text: 'La política de privacidad/cookies describe el uso de cookies analíticas y de tracking basado en consentimiento. Sin embargo, durante el escaneo no se detectó un mecanismo visible de consentimiento antes de la carga de determinados trackers/cookies. Esto requiere revisión técnica.',
    confidence: 'medium',
  };
}

function localizeMarketProfile(profile, lang) {
  if (lang === 'es') return profile;
  const labels = {
    en: {
      eu: ['General EU', 'Visible technical risk against common European consent, transparency and third-party criteria.'],
      es: ['Spain / AEPD', 'Cookies, first-layer consent, equivalent reject option, layered transparency and forms.'],
      nl: ['Netherlands regulatory profile: AP + ACM', 'Tracking cookies, privacy-friendly analytics, prior consent and real ease of refusal.'],
    },
    nl: {
      eu: ['Algemene EU', 'Zichtbaar technisch risico tegenover Europese criteria voor toestemming, transparantie en derden.'],
      es: ['Spanje / AEPD', 'Cookies, toestemming in de eerste laag, gelijkwaardige weigeroptie, gelaagde transparantie en formulieren.'],
      nl: ['Nederlands regelgevingsprofiel: AP + ACM', 'Trackingcookies, privacyvriendelijke analytics, voorafgaande toestemming en eenvoudig weigeren.'],
    },
  };
  const [label, focus] = labels[lang]?.[profile.code] || [profile.label, profile.focus];
  return { ...profile, label, focus };
}

function localizeFinding(finding, lang) {
  if (lang === 'es') return finding;
  const variantKey = `${finding.checkId}:${finding.severity}`;
  const copy = FINDING_COPY[lang]?.[variantKey] || FINDING_COPY[lang]?.[finding.checkId];
  return {
    ...finding,
    title: copy?.title || finding.title,
    recommendation: copy?.recommendation || finding.recommendation,
    authority: LOCAL_TEXT[lang].regulatoryReference,
    evidence: localizeEvidenceList(finding.evidence || [], lang),
  };
}

function localizeEvidenceList(evidence, lang) {
  return evidence.map(item => {
    if (item && typeof item === 'object') {
      const next = { ...item };
      if (typeof next.value === 'string') next.value = localizeEvidenceText(next.value, lang);
      return next;
    }
    return localizeEvidenceText(String(item), lang);
  });
}

function localizeEvidenceText(value, lang) {
  if (lang === 'es') return value;

  const dictionaries = {
    en: [
      [/^URL analizada:/i, 'Analysed URL:'],
      [/^Botón "Aceptar" detectado:/i, 'Accept button detected:'],
      [/^Botón "Rechazar" detectado:/i, 'Reject button detected:'],
      [/^Botón "Configurar" detectado:/i, 'Preferences button detected:'],
      [/^CMP detectado por selector:/i, 'CMP detected by selector:'],
      [/^Casillas pre-marcadas detectadas:/i, 'Pre-checked boxes detected:'],
      [/^Texto detectado:/i, 'Text detected:'],
      [/^Dominio detectado:/i, 'Domain detected:'],
      [/^Se detectaron (\d+) dominios externos únicos en las peticiones de red$/i, '$1 unique external domains detected in network requests'],
      [/^(\d+) formulario\(s\) con casillas de marketing pre-marcadas detectadas$/i, '$1 form(s) with pre-checked marketing boxes detected'],
      [/^(\d+) formulario\(s\) con datos personales sin enlace de privacidad cercano$/i, '$1 personal-data form(s) without nearby privacy link'],
      [/^(.+): (\d+) días restantes$/i, '$1: $2 days remaining'],
      [/No se encontró ningún CMP activo durante el escaneo/i, 'No active CMP was found during the scan'],
      [/No se encontró CMP ni actividad de terceros relevante/i, 'No CMP or relevant third-party activity was found'],
      [/Rechazo accesible solo desde panel de preferencias/i, 'Reject option appears accessible only from the preference panel'],
      [/Botón "Aceptar" detectado, botón "Rechazar" no encontrado en primera capa/i, 'Accept button detected, reject button not found in the first layer'],
      [/Botones "Aceptar" y "Rechazar" detectados/i, 'Accept and reject buttons detected'],
      [/No se encontró ningún enlace relacionado con privacidad en la página analizada/i, 'No privacy-related link was found on the analysed page'],
      [/No se encontró enlace con texto relacionado específicamente con cookies/i, 'No link with cookie-specific text was found'],
      [/No se encontraron señales suficientes en la política enlazada o en la página analizada/i, 'Not enough relevant signals were found in the linked policy or analysed page'],
      [/No se pudo extraer texto suficiente de la política enlazada/i, 'Not enough text could be extracted from the linked policy'],
      [/Overlay de gran tamaño detectado que podría bloquear el acceso al contenido/i, 'Large overlay detected that may block access to content'],
    ],
    nl: [
      [/^URL analizada:/i, 'Geanalyseerde URL:'],
      [/^Botón "Aceptar" detectado:/i, 'Accepteren-knop gedetecteerd:'],
      [/^Botón "Rechazar" detectado:/i, 'Weigeren-knop gedetecteerd:'],
      [/^Botón "Configurar" detectado:/i, 'Voorkeuren-knop gedetecteerd:'],
      [/^CMP detectado por selector:/i, 'CMP gedetecteerd via selector:'],
      [/^Casillas pre-marcadas detectadas:/i, 'Vooraf aangevinkte vakjes gedetecteerd:'],
      [/^Texto detectado:/i, 'Tekst gedetecteerd:'],
      [/^Dominio detectado:/i, 'Domein gedetecteerd:'],
      [/^Se detectaron (\d+) dominios externos únicos en las peticiones de red$/i, '$1 unieke externe domeinen gedetecteerd in netwerkverzoeken'],
      [/^(\d+) formulario\(s\) con casillas de marketing pre-marcadas detectadas$/i, '$1 formulier(en) met vooraf aangevinkte marketingvakjes gedetecteerd'],
      [/^(\d+) formulario\(s\) con datos personales sin enlace de privacidad cercano$/i, '$1 formulier(en) met persoonsgegevens zonder nabije privacylink'],
      [/^(.+): (\d+) días restantes$/i, '$1: $2 dagen resterend'],
      [/No se encontró ningún CMP activo durante el escaneo/i, 'Geen actieve CMP gevonden tijdens de scan'],
      [/No se encontró CMP ni actividad de terceros relevante/i, 'Geen CMP of relevante derdepartijactiviteit gevonden'],
      [/Rechazo accesible solo desde panel de preferencias/i, 'Weigeren lijkt alleen bereikbaar via het voorkeurenpaneel'],
      [/Botón "Aceptar" detectado, botón "Rechazar" no encontrado en primera capa/i, 'Accepteren-knop gedetecteerd, weigeren-knop niet gevonden in de eerste laag'],
      [/Botones "Aceptar" y "Rechazar" detectados/i, 'Accepteren- en weigeren-knoppen gedetecteerd'],
      [/No se encontró ningún enlace relacionado con privacidad en la página analizada/i, 'Geen privacygerelateerde link gevonden op de geanalyseerde pagina'],
      [/No se encontró enlace con texto relacionado específicamente con cookies/i, 'Geen link met cookie-specifieke tekst gevonden'],
      [/No se encontraron señales suficientes en la política enlazada o en la página analizada/i, 'Onvoldoende relevante signalen gevonden in het gekoppelde beleid of de geanalyseerde pagina'],
      [/No se pudo extraer texto suficiente de la política enlazada/i, 'Er kon onvoldoende tekst uit het gekoppelde beleid worden gehaald'],
      [/Overlay de gran tamaño detectado que podría bloquear el acceso al contenido/i, 'Grote overlay gedetecteerd die toegang tot content kan blokkeren'],
    ],
  };

  return (dictionaries[lang] || []).reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function localizeOutput(payload, lang) {
  if (lang === 'es') return payload;
  const text = LOCAL_TEXT[lang];
  const findings = payload.findings.map(f => localizeFinding(f, lang));
  const criticals = findings.filter(f => f.severity === 'critical').length;
  const highs = findings.filter(f => f.severity === 'high').length;
  const summary = buildLocalizedSummary({ criticals, highs, band: payload.riskLevel || payload.band, lang });

  return {
    ...payload,
    marketProfile: localizeMarketProfile(payload.marketProfile, lang),
    scoreExplanation: text.scoreExplanation,
    summary,
    contextualExplanation: text.contextualExplanation,
    findings,
    documentationDiscrepancy: payload.documentationDiscrepancy ? {
      title: text.documentationTitle,
      text: text.documentationText,
      confidence: payload.documentationDiscrepancy.confidence,
    } : null,
    scanLimitations: text.scanLimitations.map(item =>
      item.replace('{market}', localizeMarketProfile(payload.marketProfile, lang).label)
    ),
    disclaimer: text.disclaimer.replace('{market}', localizeMarketProfile(payload.marketProfile, lang).label),
    recommendedNextSteps: text.recommendedNextSteps,
  };
}

function buildLocalizedSummary({ criticals, highs, band, lang }) {
  if (lang === 'nl') {
    if (band === 'critical' && criticals > 0) {
      return criticals === 1
        ? 'De scanner detecteerde 1 kritisch technisch risicosignaal. Beoordeel de belangrijkste bevindingen voordat juridische conclusies worden getrokken.'
        : `De scanner detecteerde ${criticals} kritische technische risicosignalen. Beoordeel de belangrijkste bevindingen voordat juridische conclusies worden getrokken.`;
    }
    if ((band === 'high' || band === 'critical') && highs > 0) {
      return highs === 1
        ? 'Er zijn geen kritieke signalen gevonden, maar wel 1 technisch hoog-risicosignaal dat beoordeling kan vereisen.'
        : `Er zijn geen kritieke signalen gevonden, maar wel ${highs} technische hoog-risicosignalen die beoordeling kunnen vereisen.`;
    }
    if (band === 'medium') {
      return 'Er zijn technische risicosignalen gevonden met een gemiddeld totaalrisico. Bekijk de belangrijkste bevindingen en aanvullende observaties.';
    }
    return LOCAL_TEXT.nl.summaryLow;
  }

  if (band === 'critical' && criticals > 0) {
    return criticals === 1
      ? 'The scanner detected 1 critical technical risk signal. Review the main findings before drawing legal conclusions.'
      : `The scanner detected ${criticals} critical technical risk signals. Review the main findings before drawing legal conclusions.`;
  }
  if ((band === 'high' || band === 'critical') && highs > 0) {
    return highs === 1
      ? 'No critical signals were detected, but 1 high-risk technical signal may require review.'
      : `No critical signals were detected, but ${highs} high-risk technical signals may require review.`;
  }
  if (band === 'medium') {
    return 'Technical risk signals were detected with a moderate overall risk. Review the main findings and additional observations.';
  }
  return LOCAL_TEXT.en.summaryLow;
}

const LOCAL_TEXT = {
  en: {
    regulatoryReference: 'Indicative regulatory reference: GDPR/ePrivacy and national cookie guidance. Review recommended.',
    scoreExplanation: 'The privacy technical health score reflects automated technical signals observed during the risk scan. A lower score means higher technical risk. It is not a complete legal assessment.',
    summaryCritical: 'The scanner detected {count} critical technical risk signal(s). Review the main findings before drawing legal conclusions.',
    summaryHigh: 'No critical signals were detected, but {count} high-risk technical signal(s) may require review.',
    summaryLow: 'No critical or high-risk technical signals were detected during this scan. Review the additional observations and limitations.',
    contextualExplanation: 'This scan reflects observable behaviour at the time of testing from a clean browser context. It is not a legal conclusion and should be reviewed by a privacy professional before decisions are made.',
    documentationTitle: 'Possible discrepancy between documentation and implementation',
    documentationText: 'The privacy/cookie policy describes the use of analytics and tracking cookies based on consent. However, during the scan no visible consent mechanism was detected before certain trackers/cookies loaded. This requires technical review.',
    disclaimer: 'This report is informational and technical. It is not legal advice and does not certify compliance with any law. Findings are based on automated evidence observed during the risk scan and may not reflect later changes. Applied profile: {market}. Review with a DPO or specialised legal advisor is recommended.',
    recommendedNextSteps: [
      'Review the main risks with the website owner, tag manager owner and DPO/privacy advisor.',
      'Block analytics, advertising and social pixels until the relevant consent signal is present.',
      'Check whether a documented low-impact analytics exemption applies.',
      'Verify the first-layer cookie banner offers accept, reject and preference options with comparable visibility.',
      'Align the privacy/cookie policy with the trackers, cookies and providers actually detected.',
      'Run a follow-up risk scan after remediation and keep both reports as implementation evidence.',
    ],
      scanLimitations: [
        'Client-side scan only — server-side tagging (SST) may hide additional trackers.',
        'Google Consent Mode v2 behavior depends on site configuration and cannot be fully verified client-side.',
        'Dark pattern assessment is heuristic and may require human UX review.',
        'Region/IP used: {market}, from the infrastructure running this server; this may not match the visitor location.',
      'Browser used: Chromium headless with a clean context.',
      'The scan did not log in as a registered user or test private areas.',
      'Not all pages were tested; the scan is limited to the requested URL and resources loaded during the observation window.',
      'Results may vary by geolocation, language, device, previous consent, A/B testing or later site changes.',
    ],
  },
  nl: {
    regulatoryReference: 'Indicatieve regelgevingsreferentie: GDPR/ePrivacy en nationale cookierichtlijnen. Beoordeling aanbevolen.',
    scoreExplanation: 'De privacy technical health score weerspiegelt geautomatiseerde technische signalen die tijdens de risicoscan zijn waargenomen. Een lagere score betekent hoger technisch risico. Het is geen volledige juridische beoordeling.',
    summaryCritical: 'De scanner detecteerde {count} kritisch(e) technisch(e) risicosignaal/signalen. Beoordeel de belangrijkste bevindingen voordat juridische conclusies worden getrokken.',
    summaryHigh: 'Er zijn geen kritieke signalen gevonden, maar wel {count} technisch(e) hoog-risicosignaal/signalen die beoordeling kunnen vereisen.',
    summaryLow: 'Tijdens deze scan zijn geen kritieke of hoge technische risicosignalen gevonden. Bekijk wel de aanvullende observaties en beperkingen.',
    contextualExplanation: 'Deze scan toont alleen waarneembaar gedrag op het moment van testen vanuit een schone browsercontext. Het is geen juridische conclusie en moet door een privacyprofessional worden beoordeeld voordat beslissingen worden genomen.',
    documentationTitle: 'Mogelijke discrepantie tussen documentatie en implementatie',
    documentationText: 'Het privacy-/cookiebeleid beschrijft het gebruik van analytische en trackingcookies op basis van toestemming. Tijdens de scan werd echter geen zichtbaar toestemmingsmechanisme gevonden voordat bepaalde trackers/cookies werden geladen. Dit vereist technische controle.',
    disclaimer: 'Dit rapport is informatief en technisch. Het is geen juridisch advies en certificeert geen naleving van wetgeving. Bevindingen zijn gebaseerd op geautomatiseerd bewijs tijdens de risicoscan en kunnen latere wijzigingen missen. Toegepast profiel: {market}. Beoordeling door een FG/DPO of gespecialiseerde jurist wordt aanbevolen.',
    recommendedNextSteps: [
      'Bespreek de belangrijkste risico’s met de website-eigenaar, tagmanagerbeheerder en FG/privacyadviseur.',
      'Blokkeer analytics-, advertentie- en social pixels totdat het relevante toestemmingssignaal aanwezig is.',
      'Controleer of een gedocumenteerde uitzondering voor low-impact analytics van toepassing is.',
      'Controleer of de eerste laag van de cookiebanner accepteren, weigeren en voorkeuren met vergelijkbare zichtbaarheid aanbiedt.',
      'Stem het privacy-/cookiebeleid af op de trackers, cookies en aanbieders die daadwerkelijk zijn gedetecteerd.',
      'Voer na herstel een nieuwe risicoscan uit en bewaar beide rapporten als implementatiebewijs.',
    ],
      scanLimitations: [
        'Alleen client-side scan — server-side tagging (SST) kan extra trackers verbergen.',
        'Google Consent Mode v2 hangt af van siteconfiguratie en kan client-side niet volledig worden geverifieerd.',
        'Beoordeling van dark patterns is heuristisch en kan menselijke UX-review vereisen.',
        'Gebruikte regio/IP: {market}, vanuit de infrastructuur waarop deze server draait; dit hoeft niet overeen te komen met de locatie van de bezoeker.',
      'Gebruikte browser: Chromium headless met een schone context.',
      'Er is niet ingelogd als geregistreerde gebruiker en privégebieden zijn niet getest.',
      'Niet alle pagina’s zijn getest; de scan beperkt zich tot de opgegeven URL en resources binnen het observatievenster.',
      'Resultaten kunnen variëren door geolocatie, taal, apparaat, eerdere toestemming, A/B-tests of latere sitewijzigingen.',
    ],
  },
};

const FINDING_COPY = {
  en: {
    'S-001': { title: 'The website does not use HTTPS', recommendation: 'Configure SSL/TLS. Without HTTPS, data transmitted between the visitor and the server is not encrypted.' },
    'C-001': { title: 'Analytics cookies detected on initial load', recommendation: 'Analytics cookies appear before consent. Review the analytics setup and block non-essential cookies until valid consent is obtained, unless a documented low-impact exemption applies.' },
    'C-002': { title: 'Advertising cookies detected on initial load', recommendation: 'Advertising or remarketing cookies appear before consent. Review urgently and block them until explicit consent is obtained.' },
    'C-003': { title: 'Advertising scripts/pixels loaded without a visible consent mechanism', recommendation: 'Advertising requests were observed before a visible consent mechanism was detected. Review the CMP or tag manager configuration.' },
    'C-004': { title: 'Google Tag Manager detected without an active consent banner', recommendation: 'Review whether GTM fires analytics or marketing tags before consent and configure consent blocking where needed.' },
    'C-005': { title: 'Meta Pixel detected before consent interaction', recommendation: 'Meta Pixel activity appears before consent interaction. Block marketing pixels until consent is obtained.' },
    'C-006': { title: 'LinkedIn Insight Tag detected before consent interaction', recommendation: 'LinkedIn Insight Tag appears to load before consent. Review CMP or tag manager rules.' },
    'C-007': { title: 'Heatmap/session tools detected before consent', recommendation: 'Session or heatmap tools were observed during initial load. These tools should generally wait for valid consent.' },
    'C-001b': { title: 'Analytics tools detected without a visible consent mechanism', recommendation: 'Analytics tools appear to load before a visible consent mechanism. Review whether they are consented, exempt, or blocked correctly.' },
    'B-001': { title: 'No active consent mechanism detected despite third-party activity', recommendation: 'No visible CMP/banner was detected while third-party activity was observed. Implement or fix a CMP that blocks non-essential scripts before consent.' },
    'B-001:low': { title: 'No cookie banner detected during the scan', recommendation: 'If the website does not use non-essential cookies, a banner may not be required. If it does, implement an appropriate consent mechanism. Manual verification is recommended.' },
    'B-002': { title: 'Accept button without equivalent reject option in the first layer', recommendation: 'Add an equivalent reject option in the first layer and make accepting and rejecting equally easy.' },
    'B-003': { title: 'Rejecting cookies appears to require preference settings', recommendation: 'Make rejection as easy as acceptance. Avoid forcing users into additional layers to reject non-essential cookies.' },
    'B-004': { title: 'Pre-selected non-essential cookie options detected', recommendation: 'Disable non-essential categories by default and require a clear affirmative action.' },
    'B-005': { title: 'Text suggests continued browsing implies consent', recommendation: 'Remove passive-consent language and replace it with an explicit affirmative consent flow.' },
    'B-006': { title: 'Possible cookie wall detected', recommendation: 'Review whether access is blocked unless tracking cookies are accepted and whether an equivalent alternative exists.' },
    'P-001': { title: 'Visible privacy policy link status', recommendation: 'Verify that the privacy policy covers legal basis, retention periods, user rights, controller/DPO contact and third-party recipients.' },
    'P-001:high': { title: 'No visible privacy policy link detected', recommendation: 'Add a visible privacy policy link, especially in the footer and near forms collecting personal data.' },
    'P-002': { title: 'No separate cookie policy link detected', recommendation: 'Provide clear cookie information: purposes, providers, duration and international transfer information where relevant. This may be acceptable if the same information is clearly included inside the privacy policy.' },
    'P-003': { title: 'Cookie policy does not clearly describe purposes', recommendation: 'Add clear purposes by cookie category: technical, analytics, marketing, personalisation and third parties where relevant.' },
    'P-004': { title: 'Policy does not clearly identify detected third parties', recommendation: 'List relevant detected third-party providers, their purposes and links to provider information.' },
    'P-005': { title: 'Policy does not mention a clear legal basis for cookies or marketing', recommendation: 'Clearly explain the legal basis used for non-technical cookies, analytics, marketing and forms.' },
    'P-006': { title: 'Policy does not mention retention periods or cookie duration', recommendation: 'Include cookie duration or retention criteria in language users can understand.' },
    'P-007': { title: 'Policy does not clearly show privacy rights or contact information', recommendation: 'Include data subject rights and a clear privacy/DPO contact channel.' },
    'P-008': { title: 'Policy does not mention international transfers despite detected providers', recommendation: 'Review whether detected providers involve transfers or access outside the EEA and disclose this where applicable.' },
    'F-001': { title: 'Personal-data form without nearby privacy information', recommendation: 'Place privacy information or a clear privacy-policy link near forms collecting personal data.' },
    'F-002': { title: 'Pre-checked marketing/newsletter checkbox detected in forms', recommendation: 'Marketing or newsletter checkboxes should not be pre-selected.' },
    'F-003': { title: 'Pre-checked consent/subscription boxes detected in forms', recommendation: 'Marketing or consent boxes should not be pre-selected.' },
    'C-009': { title: 'Non-essential cookies with long duration detected', recommendation: 'Review whether the cookie duration is proportionate to its purpose and document the rationale.' },
    'C-010': { title: 'Cookies without Secure attribute detected', recommendation: 'Review Secure, SameSite and domain scope. This is a technical hardening observation.' },
    'T-001': { title: 'Multiple third-party domains detected', recommendation: 'Review and document third-party integrations and their purpose.' },
    'T-002': { title: 'Third-party services with possible international data transfer detected', recommendation: 'Review the detected providers and transfer/access implications before drawing compliance conclusions.' },
  },
  nl: {
    'S-001': { title: 'De website gebruikt geen HTTPS', recommendation: 'Configureer SSL/TLS. Zonder HTTPS is verkeer tussen bezoeker en server niet versleuteld.' },
    'C-001': { title: 'Analytische cookies gedetecteerd bij eerste laadmoment', recommendation: 'Analytische cookies lijken te worden geplaatst vóór toestemming. Controleer de analytics-configuratie en blokkeer niet-noodzakelijke cookies totdat geldige toestemming is verkregen, tenzij een gedocumenteerde laag-risico uitzondering geldt.' },
    'C-002': { title: 'Advertentiecookies gedetecteerd bij eerste laadmoment', recommendation: 'Advertentie- of remarketingcookies lijken vóór toestemming te worden geplaatst. Controleer dit dringend en blokkeer ze tot expliciete toestemming is verkregen.' },
    'C-003': { title: 'Advertentiescripts/pixels geladen zonder zichtbaar toestemmingsmechanisme', recommendation: 'Advertentieverzoeken zijn waargenomen voordat een zichtbaar toestemmingsmechanisme werd gedetecteerd. Controleer de CMP- of tagmanagerconfiguratie.' },
    'C-004': { title: 'Google Tag Manager gedetecteerd zonder actieve cookiebanner', recommendation: 'Controleer of GTM analytics- of marketingtags vóór toestemming afvuurt en stel consent blocking correct in.' },
    'C-005': { title: 'Meta Pixel gedetecteerd vóór toestemmingsinteractie', recommendation: 'Meta Pixel-activiteit lijkt plaats te vinden vóór toestemming. Blokkeer marketingpixels totdat toestemming is verkregen.' },
    'C-006': { title: 'LinkedIn Insight Tag gedetecteerd vóór toestemmingsinteractie', recommendation: 'De LinkedIn Insight Tag lijkt te laden vóór toestemming. Controleer CMP- of tagmanagerregels.' },
    'C-007': { title: 'Heatmap-/sessietools gedetecteerd vóór toestemming', recommendation: 'Sessie- of heatmaptools zijn waargenomen tijdens de eerste laadfase. Deze tools zouden doorgaans op geldige toestemming moeten wachten.' },
    'C-001b': { title: 'Analytics-tools gedetecteerd zonder zichtbaar toestemmingsmechanisme', recommendation: 'Analytics-tools lijken te laden vóór een zichtbaar toestemmingsmechanisme. Controleer of ze correct zijn geblokkeerd of onderbouwd als uitzondering.' },
    'B-001': { title: 'Geen actief toestemmingsmechanisme gedetecteerd ondanks activiteit van derden', recommendation: 'Er werd geen zichtbare CMP/banner gevonden terwijl activiteit van derden werd waargenomen. Implementeer of herstel een CMP die niet-noodzakelijke scripts blokkeert vóór toestemming.' },
    'B-001:low': { title: 'Geen cookiebanner gedetecteerd tijdens de scan', recommendation: 'Als de website geen niet-noodzakelijke cookies gebruikt, is een banner mogelijk niet nodig. Als dat wel zo is, implementeer dan een passend toestemmingsmechanisme. Handmatige verificatie wordt aanbevolen.' },
    'B-002': { title: 'Accepteerknop zonder gelijkwaardige weigeroptie in de eerste laag', recommendation: 'Voeg een gelijkwaardige weigeroptie toe in de eerste laag en maak accepteren en weigeren even eenvoudig.' },
    'B-003': { title: 'Cookies weigeren lijkt via voorkeuren te moeten', recommendation: 'Maak weigeren net zo eenvoudig als accepteren. Dwing gebruikers niet naar extra lagen om niet-noodzakelijke cookies te weigeren.' },
    'B-004': { title: 'Vooraf geselecteerde niet-noodzakelijke cookie-opties gedetecteerd', recommendation: 'Zet niet-noodzakelijke categorieën standaard uit en vereis een duidelijke actieve handeling.' },
    'B-005': { title: 'Tekst suggereert dat verder browsen toestemming inhoudt', recommendation: 'Verwijder passieve toestemmingstekst en vervang deze door een expliciete toestemmingsflow.' },
    'B-006': { title: 'Mogelijke cookiewall gedetecteerd', recommendation: 'Controleer of toegang wordt geblokkeerd tenzij trackingcookies worden geaccepteerd en of er een gelijkwaardig alternatief bestaat.' },
    'P-001': { title: 'Status zichtbare link naar privacybeleid', recommendation: 'Controleer of het privacybeleid rechtsgrond, bewaartermijnen, rechten, contactgegevens van verwerkingsverantwoordelijke/FG en derde ontvangers dekt.' },
    'P-001:high': { title: 'Geen zichtbare link naar privacybeleid gedetecteerd', recommendation: 'Voeg een zichtbare link naar het privacybeleid toe, vooral in de footer en bij formulieren die persoonsgegevens verzamelen.' },
    'P-002': { title: 'Geen specifieke link naar cookiebeleid gedetecteerd', recommendation: 'Geef duidelijke cookie-informatie: doeleinden, aanbieders, duur en informatie over internationale doorgifte waar relevant.' },
    'P-003': { title: 'Cookiebeleid beschrijft doeleinden niet duidelijk', recommendation: 'Voeg duidelijke doeleinden toe per cookiecategorie: technisch, analytics, marketing, personalisatie en derden waar relevant.' },
    'P-004': { title: 'Beleid identificeert gedetecteerde derden niet duidelijk', recommendation: 'Vermeld relevante gedetecteerde derde aanbieders, hun doeleinden en links naar aanbiederinformatie.' },
    'P-005': { title: 'Beleid noemt geen duidelijke rechtsgrond voor cookies of marketing', recommendation: 'Leg duidelijk uit welke rechtsgrond wordt gebruikt voor niet-technische cookies, analytics, marketing en formulieren.' },
    'P-006': { title: 'Beleid noemt geen bewaartermijnen of cookieduur', recommendation: 'Neem cookieduur of bewaartermijncriteria op in begrijpelijke taal.' },
    'P-007': { title: 'Beleid toont privacyrechten of contactinformatie niet duidelijk', recommendation: 'Neem rechten van betrokkenen en een duidelijk privacy-/FG-contactkanaal op.' },
    'P-008': { title: 'Beleid noemt geen internationale doorgifte ondanks gedetecteerde aanbieders', recommendation: 'Controleer of gedetecteerde aanbieders doorgifte of toegang buiten de EER impliceren en vermeld dit waar van toepassing.' },
    'F-001': { title: 'Formulier met persoonsgegevens zonder nabije privacy-informatie', recommendation: 'Plaats privacy-informatie of een duidelijke link naar het privacybeleid bij formulieren die persoonsgegevens verzamelen.' },
    'F-002': { title: 'Vooraf aangevinkte marketing-/nieuwsbriefcheckbox gedetecteerd in formulieren', recommendation: 'Marketing- of nieuwsbriefcheckboxes mogen niet vooraf geselecteerd zijn.' },
    'F-003': { title: 'Vooraf aangevinkte toestemmings-/inschrijvingsvakken in formulieren', recommendation: 'Marketing- of toestemmingsvakken mogen niet vooraf geselecteerd zijn.' },
    'C-009': { title: 'Niet-noodzakelijke cookies met lange duur gedetecteerd', recommendation: 'Controleer of de cookieduur proportioneel is ten opzichte van het doel en documenteer de onderbouwing.' },
    'C-010': { title: 'Cookies zonder Secure-attribuut gedetecteerd', recommendation: 'Controleer Secure, SameSite en domeinbereik. Dit is een technische hardening-observatie.' },
    'T-001': { title: 'Meerdere domeinen van derden gedetecteerd', recommendation: 'Controleer en documenteer integraties met derden en hun doel.' },
    'T-002': { title: 'Diensten van derden met mogelijke internationale gegevensdoorgifte gedetecteerd', recommendation: 'Controleer de gedetecteerde aanbieders en mogelijke doorgifte/toegang voordat complianceconclusies worden getrokken.' },
  },
};

// ─── Detección de banner + B-004 + B-005 + B-006 ───────────────────────────

async function detectCookieBanner(page) {
  const result = {
    hasBanner: false,
    hasAcceptButton: false,
    hasRejectButton: false,
    hasManageButton: false,
    hasPreCheckedBoxes: false,   // B-004
    hasBrowseConsent: false,     // B-005
    hasCookieWall: false,        // B-006
    evidence: [],
  };

  const buttonsAndLinks = await page.$$eval(
    'button, a, [role="button"], input[type="button"], input[type="submit"]',
    els => els.map(el => ({
      text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim(),
      visible: el.offsetParent !== null,
    }))
  ).catch(() => []);

  const bodyText = await page.locator('body').innerText().catch(() => '');

  // Banner presence
  result.hasBanner =
    containsKeyword(bodyText, CONSENT_KEYWORDS.banner) ||
    buttonsAndLinks.some(b => b.visible && containsKeyword(b.text, CONSENT_KEYWORDS.banner));

  // Buttons
  for (const btn of buttonsAndLinks) {
    if (!btn.text) continue;
    if (containsKeyword(btn.text, CONSENT_KEYWORDS.accept) && !result.hasAcceptButton) {
      result.hasAcceptButton = true;
      result.evidence.push(`Botón "Aceptar" detectado: "${btn.text.slice(0, 60)}"`);
    }
    if (containsKeyword(btn.text, CONSENT_KEYWORDS.reject) && !result.hasRejectButton) {
      result.hasRejectButton = true;
      result.evidence.push(`Botón "Rechazar" detectado: "${btn.text.slice(0, 60)}"`);
    }
    if (containsKeyword(btn.text, CONSENT_KEYWORDS.manage) && !result.hasManageButton) {
      result.hasManageButton = true;
      result.evidence.push(`Botón "Configurar" detectado: "${btn.text.slice(0, 60)}"`);
    }
  }

  // Known CMP selectors
  const cmpSelectors = [
    '#CybotCookiebotDialog', '#onetrust-banner-sdk', '.cc-window',
    '#cookie-notice', '#cookie-banner', '#cookie-consent',
    '.cookie-banner', '.cookie-notice', '.cookie-consent',
    '[id*="cookie"]', '[class*="cookie-banner"]', '[class*="consent-banner"]',
    '[aria-label*="cookie"]', '[aria-label*="consent"]',
  ];
  for (const sel of cmpSelectors) {
    const found = await page.$(sel).catch(() => null);
    if (found) {
      result.hasBanner = true;
      result.evidence.push(`CMP detectado por selector: ${sel.slice(0, 50)}`);
      break;
    }
  }

  // B-004: Pre-checked checkboxes for non-essential cookies
  const preChecked = await page.$$eval(
    'input[type="checkbox"][checked], input[type="checkbox"]:checked',
    els => els.filter(el => {
      const label = (el.getAttribute('name') || el.getAttribute('id') || el.getAttribute('aria-label') || '').toLowerCase();
      const nearby = el.closest('div, li, label')?.innerText?.toLowerCase() || '';
      const cookieRelated = ['analytic', 'marketing', 'advertis', 'functional', 'statistic',
        'social', 'targeting', 'tracking', 'preference', 'cookies'].some(k => label.includes(k) || nearby.includes(k));
      return cookieRelated;
    }).map(el => el.getAttribute('name') || el.getAttribute('id') || 'checkbox')
  ).catch(() => []);

  if (preChecked.length > 0) {
    result.hasPreCheckedBoxes = true;
    result.evidence.push(`Casillas pre-marcadas detectadas: ${preChecked.slice(0, 3).join(', ')}`);
  }

  // B-005: "Seguir navegando" as consent
  const lowerBody = bodyText.toLowerCase();
  const matchedPattern = BROWSE_CONSENT_PATTERNS.find(p => lowerBody.includes(p.toLowerCase()));
  if (matchedPattern) {
    result.hasBrowseConsent = true;
    result.evidence.push(`Texto detectado: "...${matchedPattern}..."`);
  }

  // B-006: Cookie wall — overlay blocking content
  const hasOverlay = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('div, section, aside')];
    for (const el of candidates) {
      const st = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const isOverlay = (st.position === 'fixed' || st.position === 'absolute') &&
        parseFloat(st.zIndex) > 100 &&
        rect.width > window.innerWidth * 0.7 &&
        rect.height > window.innerHeight * 0.7;
      if (!isOverlay) continue;
      const text = (el.innerText || '').toLowerCase();
      if (text.includes('cookie') || text.includes('consent') || text.includes('privacy')) {
        // Check if there's no visible close/reject option
        const hasReject = text.includes('reject') || text.includes('rechazar') || text.includes('weiger') ||
          text.includes('decline') || text.includes('refuse');
        if (!hasReject) return true;
      }
    }
    return false;
  }).catch(() => false);

  if (hasOverlay) {
    result.hasCookieWall = true;
    result.evidence.push('Overlay de gran tamaño detectado que podría bloquear el acceso al contenido');
  }

  return result;
}

// ─── Política de privacidad + P-002 ────────────────────────────────────────

async function detectPrivacyPolicy(page) {
  const links = await page.$$eval('a', els =>
    els.map(a => ({
      text: (a.innerText || a.textContent || '').trim(),
      href: a.href || '',
      title: a.getAttribute('title') || '',
    }))
  ).catch(() => []);

  const privacyLinks = links.filter(l =>
    containsKeyword(l.text, PRIVACY_LINK_TEXTS) ||
    containsKeyword(l.title, PRIVACY_LINK_TEXTS) ||
    containsKeyword(l.href, ['privacy', 'privacidad', 'privacyverklaring', 'datenschutz'])
  );

  const cookiePolicyLinks = links.filter(l =>
    containsKeyword(l.text, COOKIE_POLICY_TEXTS) ||
    containsKeyword(l.href, ['cookies', 'cookie-policy', 'cookiebeleid'])
  );

  const privacyUrls = privacyLinks.slice(0, 3).map(l => l.href || l.text).filter(Boolean);
  const cookiePolicyUrls = cookiePolicyLinks.slice(0, 2).map(l => l.href || l.text).filter(Boolean);
  const policyText = await collectPolicyText(page, [...privacyUrls, ...cookiePolicyUrls]);
  const policyChecks = analyzePolicyText(policyText);

  return {
    hasPrivacyLink: privacyLinks.length > 0,
    hasCookiePolicyLink: cookiePolicyLinks.length > 0,
    privacyLinks: privacyUrls,
    cookiePolicyLinks: cookiePolicyUrls,
    policyTextAvailable: policyText.length > 0,
    policyChecks,
  };
}

async function collectPolicyText(page, urls) {
  const samePageText = await page.locator('body').innerText().catch(() => '');
  const texts = [samePageText.slice(0, 30000)];
  const uniqueUrls = [...new Set((urls || []).filter(u => /^https?:\/\//i.test(u)))].slice(0, 2);
  for (const url of uniqueUrls) {
    try {
      const response = await page.request.get(url, { timeout: 8000 });
      if (!response.ok()) continue;
      const html = await response.text();
      texts.push(html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 40000));
    } catch { /* optional policy fetch */ }
  }
  return texts.join(' ').toLowerCase();
}

function analyzePolicyText(text) {
  const t = normalizeText(text);
  const has = patterns => patterns.some(p => t.includes(p));
  return {
    hasCookiePurposes: has(['purpose', 'purposes', 'finalidad', 'finalidades', 'doeleinden', 'doel', 'analytics', 'analítica', 'analytische', 'marketing', 'advertising', 'publicidad']),
    hasThirdParties: has(['third party', 'third-party', 'terceros', 'proveedores', 'partners', 'derden', 'verwerkers', 'google', 'linkedin', 'meta', 'facebook', 'doubleclick']),
    hasLegalBasis: has(['legal basis', 'lawful basis', 'base legal', 'basis legal', 'rechtsgrond', 'toestemming', 'consentimiento', 'consent', 'legitimate interest', 'interés legítimo', 'gerechtvaardigd belang']),
    hasRetention: has(['retention', 'retained', 'storage period', 'conservation', 'conservación', 'plazo', 'bewaartermijn', 'bewaren', 'months', 'meses', 'maanden', 'days', 'días', 'dagen']),
    hasRightsAndContact: has(['access', 'rectification', 'erasure', 'objection', 'derechos', 'acceso', 'rectificación', 'supresión', 'oposición', 'inzage', 'rectificatie', 'verwijdering', 'bezwaar', 'dpo', 'fg', 'contact', 'email', '@']),
    hasTransfers: has(['international transfer', 'third countries', 'outside the eea', 'outside the eu', 'transferencias internacionales', 'terceros países', 'fuera del eee', 'fuera de la ue', 'doorgifte', 'buiten de eu', 'buiten de eer', 'standard contractual clauses', 'scc']),
  };
}

// ─── Atributos de cookies: C-009 (duración), C-010 (Secure/SameSite) ───────

function analyzeCookieAttributes(cookies) {
  const longLived = [];
  const insecure = [];
  const THIRTEEN_MONTHS_SEC = 13 * 30 * 24 * 3600;

  for (const c of cookies) {
    // Duration check (C-009) — only for non-essential cookies
    if (isTrackingCookie(c.name)) {
      const maxAge = c.expires && c.expires > 0
        ? c.expires - Math.floor(Date.now() / 1000)
        : null;
      if (maxAge && maxAge > THIRTEEN_MONTHS_SEC) {
        longLived.push({ name: c.name, daysLeft: Math.round(maxAge / 86400) });
      }
    }
    // Secure/SameSite (C-010)
    if (!c.secure && c.domain && !c.domain.startsWith('localhost')) {
      insecure.push(c.name);
    }
  }
  return { longLived, insecure };
}

// ─── Formularios ────────────────────────────────────────────────────────────

async function detectForms(page) {
  const forms = await page.$$eval('form', forms =>
    forms.map(f => {
      const inputs = [...f.querySelectorAll('input, textarea, select')];
      const text = f.innerText || '';
      const ltext = text.toLowerCase();
      const rect = f.getBoundingClientRect();
      const hasPrivacyText = ltext.includes('privac') || ltext.includes('legal') ||
        ltext.includes('política') || ltext.includes('gdpr') || ltext.includes('avg');
      const hasCheckbox = inputs.some(i =>
        i.type === 'checkbox' &&
        (i.name || i.id || '').toLowerCase().match(/privac|terms|legal|consent|gdpr/)
      );
      const hasEmailOrPhone = inputs.some(i =>
        i.type === 'email' || i.type === 'tel' ||
        (i.name || i.id || i.getAttribute('autocomplete') || '').toLowerCase().match(/email|phone|tel|nombre|surname|apellido|voornaam|achternaam|name|mail/)
      );
      // F-002: newsletter / marketing checkbox
      const hasMarketingPreChecked = inputs.some(i => {
        if (i.type !== 'checkbox' || !i.checked) return false;
        const nearby = (i.closest('label, div, p, li')?.innerText || '').toLowerCase();
        const name = (i.name || i.id || i.getAttribute('aria-label') || '').toLowerCase();
        return /newsletter|marketing|offers|ofertas|promotions|promociones|subscri|comercial/.test(`${name} ${nearby}`);
      });
      const privacyLinks = [...f.querySelectorAll('a')].filter(a =>
        /privac|legal|gdpr|avg|gegevensbescherming/.test((a.innerText || a.href || '').toLowerCase())
      );
      return { hasPrivacyText, hasCheckbox, hasEmailOrPhone, hasMarketingPreChecked, hasPreChecked: hasMarketingPreChecked, hasPrivacyLinkInside: privacyLinks.length > 0, rect: { top: rect.top, bottom: rect.bottom } };
    })
  ).catch(() => []);

  const nearbyPrivacyByForm = await page.$$eval('form', forms => forms.map(f => {
    const rect = f.getBoundingClientRect();
    const links = [...document.querySelectorAll('a')];
    return links.some(a => {
      const text = (a.innerText || a.href || '').toLowerCase();
      if (!/privac|legal|gdpr|avg|gegevensbescherming/.test(text)) return false;
      const ar = a.getBoundingClientRect();
      return Math.abs(ar.top - rect.bottom) <= 200 || Math.abs(rect.top - ar.bottom) <= 200;
    });
  })).catch(() => []);

  const looseInputs = await page.$$eval('input[type="email"]', els =>
    els.map(el => {
      const parent = el.closest('section, div, footer, aside, article') || el.parentElement;
      const parentText = parent ? (parent.innerText || '').toLowerCase() : '';
      return { hasPrivacyNearby: parentText.includes('privac') || parentText.includes('legal') };
    })
  ).catch(() => []);

  const sensitiveForms = forms.filter(f => f.hasEmailOrPhone);
  const formsWithoutPrivacy = sensitiveForms.filter((f, idx) =>
    !f.hasPrivacyText && !f.hasCheckbox && !f.hasPrivacyLinkInside && !nearbyPrivacyByForm[idx]
  );
  const formsWithPreChecked = forms.filter(f => f.hasMarketingPreChecked);
  const looseWithoutPrivacy = looseInputs.filter(i => !i.hasPrivacyNearby);

  return {
    totalForms: forms.length,
    sensitiveForms: sensitiveForms.length,
    formsWithoutPrivacy: formsWithoutPrivacy.length,
    formsWithPreChecked: formsWithPreChecked.length,
    marketingPreChecked: formsWithPreChecked.length,
    looseEmailInputs: looseInputs.length,
    looseWithoutPrivacy: looseWithoutPrivacy.length,
  };
}

// ─── Scoring — pesos del research: Critical=20, High=10, Medium=5, Low=2 ───

function calculateScore(data) {
  const findings = [];

  // Helper: añadir finding con todos los campos del research
  function addFinding(f) {
    findings.push({
      id: f.checkId,
      checkId: f.checkId,
      severity: f.severity,
      category: f.category,
      title: f.title,
      evidence: f.evidence || [],
      recommendation: f.recommendation,
      authority: REGULATORY_REFERENCE,
      confidence: f.confidence || 'high',
      requiresLegalReview: f.requiresLegalReview !== undefined ? f.requiresLegalReview : (f.severity === 'critical' || f.severity === 'high'),
      group: f.group,
    });
  }

  const trackerDomains = [...new Set(data.trackers.map(getTrackerDomain))];
  const adTrackers = trackerDomains.filter(d => getTrackerType(d) === 'advertising');
  const analyticsTrackers = trackerDomains.filter(d => getTrackerType(d) === 'analytics');
  const socialTrackers = trackerDomains.filter(d => getTrackerType(d) === 'social');
  const tagManagers = trackerDomains.filter(d => getTrackerType(d) === 'tagmanager');
  const nonEuTrackers = trackerDomains.filter(d =>
    NON_EU_PROVIDERS.some(p => d === p || d.endsWith('.' + p))
  );
  const nonEuProviders = getProviderNames(nonEuTrackers);
  const metaPixels = trackerDomains.filter(d => d === 'connect.facebook.net' || d.endsWith('.facebook.net'));
  const linkedinPixels = trackerDomains.filter(d => d === 'ads.linkedin.com' || d.endsWith('.ads.linkedin.com'));
  const heatmapTrackers = trackerDomains.filter(d =>
    ['hotjar.com', 'clarity.ms'].some(p => d === p || d.endsWith('.' + p))
  );

  const adCookies = data.trackingCookiesBefore.filter(isAdvertisingCookie);
  const analyticsCookies = data.trackingCookiesBefore.filter(c => !isAdvertisingCookie(c));

  // ── HTTPS ──
  if (!data.isHttps) {
    addFinding({
      checkId: 'S-001',
      severity: 'critical',
      category: 'https',
      title: 'La web no utiliza HTTPS',
      evidence: [`URL analizada: ${data.url}`],
      recommendation: 'Se recomienda configurar un certificado SSL/TLS. Sin HTTPS, los datos transmitidos entre el usuario y el servidor no están cifrados, lo que puede suponer un riesgo técnico crítico para cualquier web que maneje datos personales.',
      authority: 'GDPR Art. 5(1)(f)',
      confidence: 'high',
    });
  }

  // ── C-002: Cookies publicitarias antes del consentimiento (más grave) ──
  if (adCookies.length > 0) {
    addFinding({
      checkId: 'C-002',
      severity: 'critical',
      category: 'cookies',
      title: 'Cookies publicitarias detectadas en la carga inicial',
      evidence: adCookies,
      recommendation: 'Se han detectado cookies asociadas a publicidad comportamental antes de cualquier interacción del usuario. Este patrón puede indicar un riesgo técnico crítico respecto a las normas sobre cookies y consentimiento previo. Se recomienda revisión urgente con el DPO o asesor legal.',
      authority: 'ePrivacy Art. 5(3) · GDPR Art. 6 · AEPD Guía Cookies',
      confidence: 'high',
      requiresLegalReview: true,
    });
  }

  // ── C-001: Cookies de analítica antes del consentimiento ──
  if (analyticsCookies.length > 0) {
    addFinding({
      checkId: 'C-001',
      severity: 'critical',
      category: 'cookies',
      title: 'Cookies de analítica detectadas en la carga inicial',
      evidence: analyticsCookies,
      recommendation: 'Se han detectado cookies de analítica antes de obtener consentimiento. Según los criterios de ePrivacy y las guías de la AEPD y AP, la analítica clásica (GA, etc.) requiere consentimiento previo salvo configuración de bajo impacto (IP anonimizada, sin compartir con terceros). Se recomienda revisión técnica y legal.',
      authority: 'ePrivacy Art. 5(3) · ACM/AP Cookiewetgeving · AEPD Guía Cookies',
      confidence: 'medium',
      requiresLegalReview: true,
    });
  }

  // ── C-003: Trackers publicitarios sin banner ──
  if (adTrackers.length > 0 && !data.banner.hasBanner) {
    addFinding({
      checkId: 'C-003',
      severity: 'critical',
      category: 'trackers',
      title: 'Scripts/píxeles publicitarios cargados sin mecanismo de consentimiento visible',
      evidence: requestEvidenceForDomains(data.requests, adTrackers, 8),
      recommendation: 'El scanner detectó peticiones a dominios de publicidad antes de que aparezca ningún banner de consentimiento. Este patrón puede indicar un riesgo técnico crítico. Las guías del EDPB y la AEPD consideran problemático cargar tracking antes de obtener consentimiento.',
      authority: 'ePrivacy Art. 5(3) · EDPB Guidelines 05/2020 · AEPD Guía Cookies 2024',
      confidence: 'high',
      requiresLegalReview: true,
    });
  } else if (adTrackers.length > 0 && data.banner.hasBanner) {
    addFinding({
      checkId: 'C-003',
      severity: 'high',
      category: 'trackers',
      title: 'Scripts publicitarios detectados antes de interacción con el banner',
      evidence: requestEvidenceForDomains(data.requests, adTrackers, 8),
      recommendation: 'Se detectaron peticiones a dominios de publicidad antes de que el usuario pudiera interactuar con el banner. Este patrón puede indicar que el CMP no está bloqueando correctamente estos scripts. Se recomienda verificar la configuración del gestor de etiquetas.',
      authority: 'ePrivacy Art. 5(3) · EDPB Guidelines 05/2020',
      confidence: 'medium',
      requiresLegalReview: true,
    });
  }

  // ── C-005: Meta Pixel ──
  if (metaPixels.length > 0) {
    addFinding({
      checkId: 'C-005',
      severity: 'critical',
      category: 'trackers',
      title: 'Meta Pixel detectado antes de interacción con el consentimiento',
      evidence: requestEvidenceForDomains(data.requests, metaPixels, 4),
      recommendation: 'Se observa actividad asociada a Meta Pixel antes de cualquier acción de consentimiento. Este patrón puede indicar tracking publicitario de alto riesgo y debería bloquearse hasta obtener consentimiento explícito.',
      authority: 'ePrivacy Art. 5(3) · GDPR Art. 6 · EDPB Guidelines 05/2020',
      confidence: 'high',
      requiresLegalReview: true,
    });
  }

  // ── C-006: LinkedIn Insight Tag ──
  if (linkedinPixels.length > 0) {
    addFinding({
      checkId: 'C-006',
      severity: 'high',
      category: 'trackers',
      title: 'LinkedIn Insight Tag detectado antes de interacción con el consentimiento',
      evidence: requestEvidenceForDomains(data.requests, linkedinPixels, 4),
      recommendation: 'La etiqueta de LinkedIn parece cargarse antes del consentimiento. Se recomienda revisar el CMP o el gestor de etiquetas para impedir su ejecución hasta que el usuario acepte finalidades de marketing.',
      authority: 'ePrivacy Art. 5(3) · EDPB Guidelines 05/2020',
      confidence: 'high',
      requiresLegalReview: true,
    });
  }

  // ── C-007: Heatmaps / session replay ──
  if (heatmapTrackers.length > 0) {
    addFinding({
      checkId: 'C-007',
      severity: 'high',
      category: 'trackers',
      title: 'Herramientas de heatmap o sesión detectadas antes del consentimiento',
      evidence: requestEvidenceForDomains(data.requests, heatmapTrackers, 4),
      recommendation: 'Se detectaron herramientas como Hotjar o Clarity durante la carga inicial. Estas tecnologías pueden registrar comportamiento de navegación y normalmente deben esperar a un consentimiento válido.',
      authority: 'ePrivacy Art. 5(3) · EDPB Guidelines 05/2020 · AEPD Guía Cookies',
      confidence: 'high',
      requiresLegalReview: true,
    });
  }

  // ── C-004: Google Tag Manager ──
  if (tagManagers.length > 0 && !data.banner.hasBanner) {
    addFinding({
      checkId: 'C-004',
      severity: 'high',
      category: 'trackers',
      title: 'Google Tag Manager detectado sin banner de consentimiento activo',
      evidence: [`Dominio detectado: ${tagManagers[0]}`],
      recommendation: 'GTM se carga antes de que aparezca un mecanismo de consentimiento visible. Si GTM dispara etiquetas de analítica o publicidad, esto puede indicar un riesgo técnico elevado. Se recomienda revisar la configuración para garantizar que GTM respeta las preferencias de consentimiento.',
      authority: 'ePrivacy Art. 5(3) · EDPB Guidelines 05/2020',
      confidence: 'medium',
      requiresLegalReview: false,
    });
  }

  // ── Trackers de analítica sin banner ──
  if (analyticsTrackers.length > 0 && !data.banner.hasBanner) {
    addFinding({
      checkId: 'C-001b',
      severity: 'high',
      category: 'trackers',
      title: 'Herramientas de analítica detectadas sin mecanismo de consentimiento visible',
      evidence: requestEvidenceForDomains(data.requests, analyticsTrackers, 6),
      recommendation: 'El scanner detectó herramientas de analítica cargándose sin que aparezca un banner de consentimiento. Salvo que estén configuradas como analítica de bajo impacto (IP anonimizada, sin compartir datos), este patrón puede requerir revisión.',
      authority: 'ePrivacy Art. 5(3) · ACM Analytische cookies exenta · AEPD Guía Cookies',
      confidence: 'medium',
      requiresLegalReview: true,
    });
  }

  // ── B-001: No banner con trackers ──
  if (!data.banner.hasBanner && trackerDomains.length > 0) {
    addFinding({
      checkId: 'B-001',
      severity: 'critical',
      category: 'cookie_banner',
      title: 'No se detectó mecanismo de consentimiento activo pese a haber actividad de terceros',
      evidence: ['No se encontró ningún CMP activo durante el escaneo', ...trackerDomains.slice(0, 5)],
      recommendation: 'El scanner no detectó un banner o CMP visible, pero sí peticiones a servicios de terceros. Si se confirma, la ausencia de mecanismo de consentimiento puede indicar un riesgo técnico crítico según las guías de la AEPD, AP y el EDPB. Se recomienda implementar un CMP que bloquee los scripts no esenciales hasta obtener consentimiento.',
      authority: 'ePrivacy Art. 5(3) · EDPB Guidelines 05/2020 · AEPD Guía Cookies 2024 · AP Telecommunicatiewet 11.7a',
      confidence: 'medium',
      requiresLegalReview: true,
    });
  } else if (!data.banner.hasBanner && trackerDomains.length === 0) {
    addFinding({
      checkId: 'B-001',
      severity: 'low',
      category: 'cookie_banner',
      title: 'No se detectó banner de cookies durante el escaneo',
      evidence: ['No se encontró CMP ni actividad de terceros relevante'],
      recommendation: 'Si la web no utiliza cookies no esenciales, no es obligatorio un banner. Si las usa, se recomienda implementar un mecanismo de consentimiento. Este punto requiere verificación manual.',
      authority: 'ePrivacy Art. 5(3)',
      confidence: 'low',
      requiresLegalReview: false,
    });
  }

  // ── B-002: Asimetría aceptar/rechazar ──
  if (data.banner.hasBanner) {
    if (data.banner.hasAcceptButton && data.banner.hasManageButton && !data.banner.hasRejectButton) {
      addFinding({
        checkId: 'B-003',
        severity: 'medium',
        category: 'cookie_banner',
        title: 'Rechazar cookies requiere navegar a "Configurar preferencias" (segunda capa)',
        evidence: data.banner.evidence.length ? data.banner.evidence : ['Rechazo accesible solo desde panel de preferencias'],
        recommendation: 'El EDPB indica que el rechazo debe ser tan fácil como la aceptación. Según las guías de la AEPD, se recomienda que la opción de rechazar esté disponible desde la primera capa, sin necesidad de acceder a submenús de configuración.',
        authority: 'EDPB Guidelines 05/2020 · EDPB 03/2022 Dark Patterns · AEPD Guía Cookies 2024',
        confidence: 'medium',
        requiresLegalReview: false,
      });
    } else if (data.banner.hasAcceptButton && !data.banner.hasRejectButton) {
      addFinding({
        checkId: 'B-002',
        severity: 'high',
        category: 'cookie_banner',
        title: 'Banner con botón "Aceptar" pero sin opción "Rechazar" equivalente visible en primera capa',
        evidence: data.banner.evidence.length ? data.banner.evidence : ['Botón "Aceptar" detectado, botón "Rechazar" no encontrado en primera capa'],
        recommendation: 'El EDPB y la AEPD establecen que aceptar y rechazar deben mostrarse "al mismo nivel" en la primera capa. Este patrón puede indicar una asimetría que las autoridades han considerado problemática. Se recomienda añadir un botón "Rechazar" equivalente en posición y tamaño al de "Aceptar".',
        authority: 'EDPB Guidelines 05/2020 · EDPB 03/2022 Dark Patterns · AEPD Guía Cookies 2024',
        confidence: 'high',
        requiresLegalReview: true,
      });
    } else if (data.banner.hasAcceptButton && data.banner.hasRejectButton) {
      addFinding({
        checkId: 'B-002',
        severity: 'ok',
        category: 'cookie_banner',
        title: 'Banner con opciones de aceptar y rechazar detectadas en primera capa',
        evidence: data.banner.evidence.length ? data.banner.evidence : ['Botones "Aceptar" y "Rechazar" detectados'],
        recommendation: 'El scanner detectó ambas opciones en primera capa. Se recomienda verificar manualmente que el botón de rechazo bloquee efectivamente todos los scripts no esenciales y que el contraste y tamaño sean equivalentes.',
        authority: 'EDPB Guidelines 05/2020 · AEPD Guía Cookies 2024',
        confidence: 'medium',
        requiresLegalReview: false,
      });
    }
  }

  // ── B-004: Casillas pre-marcadas ──
  if (data.banner.hasPreCheckedBoxes) {
    addFinding({
      checkId: 'B-004',
      severity: 'high',
      category: 'cookie_banner',
      title: 'Casillas de consentimiento para cookies no esenciales pre-marcadas detectadas',
      evidence: data.banner.evidence.filter(e => e.includes('pre-marcad')),
      recommendation: 'El Recital 32 del GDPR establece que las casillas premarcadas no constituyen consentimiento válido. La AEPD, AP y ACM han confirmado este criterio. Las opciones de cookies no esenciales deberían estar desactivadas por defecto y requerir una acción afirmativa del usuario.',
      authority: 'GDPR Art. 4(11), 7, Recital 32 · EDPB Guidelines 05/2020 · AEPD Guía Cookies',
      confidence: 'medium',
      requiresLegalReview: true,
    });
  }

  // ── B-005: "Seguir navegando" como consentimiento ──
  if (data.banner.hasBrowseConsent) {
    addFinding({
      checkId: 'B-005',
      severity: 'high',
      category: 'cookie_banner',
      title: 'Texto que indica que seguir navegando implica consentimiento',
      evidence: data.banner.evidence.filter(e => e.includes('Texto detectado')),
      recommendation: 'El EDPB, la AEPD y la AP han establecido explícitamente que "seguir navegando" o el scroll no constituyen un consentimiento válido. Este patrón puede indicar un riesgo técnico elevado. Se recomienda eliminar este texto y reemplazarlo por un mecanismo de acción afirmativa.',
      authority: 'EDPB Guidelines 05/2020 Sec. 3.4 · AEPD Guía Cookies 2024 · AP Q&A Tracking Cookies',
      confidence: 'high',
      requiresLegalReview: true,
    });
  }

  // ── B-006: Cookie wall ──
  if (data.banner.hasCookieWall) {
    addFinding({
      checkId: 'B-006',
      severity: 'critical',
      category: 'cookie_banner',
      title: 'Posible muro de cookies detectado que podría bloquear el acceso al contenido',
      evidence: data.banner.evidence.filter(e => e.includes('Overlay')),
      recommendation: 'El EDPB considera que los cookie walls generalmente no permiten un consentimiento libre. La AEPD solo los admite si existe una alternativa equivalente de acceso al servicio. La AP ha establecido criterios muy estrictos al respecto. Este hallazgo requiere revisión legal.',
      authority: 'EDPB Guidelines 05/2020 Sec. 3.1.2 · AEPD Guía Cookies · AP Cookies',
      confidence: 'low',
      requiresLegalReview: true,
    });
  }

  // ── P-001: Sin política de privacidad ──
  if (!data.privacy.hasPrivacyLink) {
    addFinding({
      checkId: 'P-001',
      severity: 'high',
      category: 'privacy_policy',
      title: 'No se detectó enlace visible a política de privacidad',
      evidence: ['No se encontró ningún enlace relacionado con privacidad en la página analizada'],
      recommendation: 'La ausencia de un enlace visible a la política de privacidad puede suponer un riesgo técnico elevado respecto al deber de transparencia (Art. 12-13 GDPR). Se recomienda incluir un enlace visible en el footer y junto a cualquier formulario.',
      authority: 'GDPR Art. 12-13 · AEPD Guía RGPD para responsables',
      confidence: 'high',
      requiresLegalReview: false,
    });
  } else {
    addFinding({
      checkId: 'P-001',
      severity: 'ok',
      category: 'privacy_policy',
      title: 'Enlace a política de privacidad detectado',
      evidence: data.privacy.privacyLinks,
      recommendation: 'Se recomienda verificar que la política cubra: base legal del tratamiento, plazos de conservación, derechos del usuario, datos de contacto del responsable/DPO, y terceros destinatarios.',
      authority: 'GDPR Art. 13',
      confidence: 'medium',
      requiresLegalReview: false,
    });
  }

  // ── P-002: Sin política de cookies ──
  if (!data.privacy.hasCookiePolicyLink && trackerDomains.length > 0) {
    const cookieInfoInPrivacyPolicy = data.privacy.hasPrivacyLink && data.privacy.policyTextAvailable && data.privacy.policyChecks?.hasCookiePurposes;
    addFinding({
      checkId: 'P-002',
      severity: cookieInfoInPrivacyPolicy ? 'medium' : 'high',
      category: 'privacy_policy',
      title: 'No se detectó enlace separado a política de cookies',
      evidence: ['No se encontró enlace con texto relacionado específicamente con cookies'],
      recommendation: cookieInfoInPrivacyPolicy
        ? 'Se encontró información de cookies dentro de la política de privacidad, pero no un enlace separado a política de cookies. Se recomienda valorar si esa información está suficientemente clara, completa y fácil de localizar.'
        : 'La LSSI y la guía de cookies de la AEPD requieren información clara y completa sobre las cookies utilizadas, sus finalidades, terceros y plazos. Se recomienda incluir una sección o página específica de cookies claramente enlazada.',
      authority: 'LSSI · AEPD Guía Cookies 2024 · ePrivacy Art. 5(3)',
      confidence: 'medium',
      requiresLegalReview: false,
    });
  }

  const pc = data.privacy.policyChecks || {};
  const hasPolicyText = data.privacy.policyTextAvailable;
  const addPolicyGap = (checkId, condition, title, recommendation, severity = 'medium') => {
    if (!condition) return;
    addFinding({
      checkId,
      severity,
      category: 'privacy_policy',
      title,
      evidence: hasPolicyText ? ['No se encontraron señales suficientes en la política enlazada o en la página analizada'] : ['No se pudo extraer texto suficiente de la política enlazada'],
      recommendation,
      confidence: hasPolicyText ? 'medium' : 'low',
      requiresLegalReview: true,
    });
  };
  addPolicyGap('P-003', data.privacy.hasCookiePolicyLink && !pc.hasCookiePurposes,
    'La política de cookies no describe claramente las finalidades',
    'Añadir finalidades claras por categoría de cookie: técnica, analítica, marketing, personalización y terceros cuando aplique.');
  addPolicyGap('P-004', trackerDomains.length > 0 && data.privacy.hasPrivacyLink && !pc.hasThirdParties,
    'La política no identifica claramente terceros detectados',
    'Listar los terceros/proveedores relevantes detectados por la implementación, sus finalidades y enlaces a información del proveedor.',
    'high');
  addPolicyGap('P-005', data.privacy.hasPrivacyLink && !pc.hasLegalBasis,
    'La política no menciona una base legal clara para cookies o marketing',
    'Explicar de forma clara la base legal aplicable a cookies no técnicas, analítica, marketing y formularios.');
  addPolicyGap('P-006', data.privacy.hasPrivacyLink && !pc.hasRetention,
    'La política no menciona plazos de conservación o duración de cookies',
    'Incluir duración de cookies o criterios de conservación comprensibles para el usuario.');
  addPolicyGap('P-007', data.privacy.hasPrivacyLink && !pc.hasRightsAndContact,
    'La política no muestra claramente derechos o contacto de privacidad',
    'Incluir derechos del interesado y un canal de contacto claro para privacidad/DPO/FG.',
    'high');
  addPolicyGap('P-008', nonEuTrackers.length > 0 && data.privacy.hasPrivacyLink && !pc.hasTransfers,
    'La política no menciona transferencias internacionales pese a proveedores detectados',
    'Revisar si los proveedores detectados implican transferencias o acceso fuera del EEE e informar de ello cuando aplique.',
    'high');

  // ── F-001: Formularios sin aviso de privacidad ──
  if (data.forms.formsWithoutPrivacy > 0 || data.forms.looseWithoutPrivacy > 0) {
    const count = data.forms.formsWithoutPrivacy + data.forms.looseWithoutPrivacy;
    addFinding({
      checkId: 'F-001',
      severity: 'medium',
      category: 'forms',
      title: `${count} formulario(s) con campos personales sin enlace a política de privacidad visible`,
      evidence: [
        `${data.forms.sensitiveForms} formulario(s) con campos de email, teléfono o nombre`,
        `${data.forms.looseEmailInputs} campo(s) de email sin aviso de privacidad cercano`,
      ],
      recommendation: 'El RGPD exige que la información sobre el tratamiento llegue al usuario en el momento de la recogida de datos (Art. 13). Se recomienda incluir un enlace a la política de privacidad y/o un checkbox de consentimiento junto a los formularios que recopilan datos personales.',
      authority: 'GDPR Art. 13 · AEPD Guía RGPD para responsables',
      confidence: 'medium',
      requiresLegalReview: false,
    });
  }

  // ── F-002: Marketing/newsletter pre-marcado ──
  if (data.forms.marketingPreChecked > 0) {
    addFinding({
      checkId: 'F-002',
      severity: 'high',
      category: 'forms',
      title: 'Casillas de marketing/newsletter pre-marcadas detectadas en formularios',
      evidence: [`${data.forms.marketingPreChecked} formulario(s) con casillas de marketing pre-marcadas detectadas`],
      recommendation: 'Las casillas premarcadas no constituyen consentimiento válido (Recital 32 GDPR). Las opciones de suscripción a comunicaciones comerciales deben requerir una acción afirmativa del usuario.',
      authority: 'GDPR Art. 4(11), 7, Recital 32 · EDPB Guidelines 05/2020',
      confidence: 'high',
      requiresLegalReview: true,
    });
  }

  // ── C-009: Cookies de duración excesiva ──
  if (data.cookieAttributes.longLived.length > 0) {
    addFinding({
      checkId: 'C-009',
      severity: 'medium',
      category: 'cookies',
      title: 'Cookies no esenciales con duración superior a 13 meses detectadas',
      evidence: data.cookieAttributes.longLived.map(c => `${c.name}: ${c.daysLeft} días restantes`),
      recommendation: 'Aunque no existe un límite legal estricto, las guías de la AEPD y el EDPB esperan que las duraciones de las cookies sean proporcionales a su finalidad. Duraciones superiores a 12-13 meses para cookies de analítica o marketing pueden incrementar el riesgo percibido y deberían justificarse.',
      authority: 'AEPD Guía Cookies · EDPB Guidelines 05/2020',
      confidence: 'high',
      requiresLegalReview: false,
    });
  }

  // ── C-010: Atributos de seguridad de cookies ──
  if (data.cookieAttributes.insecure.length > 0) {
    addFinding({
      checkId: 'C-010',
      severity: 'low',
      category: 'cookies',
      title: 'Cookies sin atributo Secure detectadas',
      evidence: data.cookieAttributes.insecure.slice(0, 8),
      recommendation: 'Algunas cookies se crean sin el atributo Secure. Aunque este hallazgo es principalmente técnico, puede afectar a la confidencialidad e integridad de datos personales. Se recomienda revisar también SameSite y limitar el alcance de dominio de las cookies.',
      authority: 'Buenas prácticas técnicas de seguridad web',
      confidence: 'low',
      requiresLegalReview: false,
      group: 'technical_observation',
    });
  }

  // ── T-001: Muchos dominios externos ──
  if (data.thirdPartyDomains > 10) {
    addFinding({
      checkId: 'T-001',
      severity: 'medium',
      category: 'third_parties',
      title: `${data.thirdPartyDomains} dominios de terceros detectados durante el escaneo`,
      evidence: [`Se detectaron ${data.thirdPartyDomains} dominios externos únicos en las peticiones de red`],
      recommendation: 'Un volumen elevado de dominios terceros puede indicar múltiples integraciones que procesan datos de usuarios. Se recomienda revisar y documentar cada integración, especialmente en el Registro de Actividades de Tratamiento (Art. 30 RGPD).',
      authority: 'GDPR Art. 30 · AEPD Guía RGPD para responsables',
      confidence: 'high',
      requiresLegalReview: false,
    });
  }

  // ── T-002: Proveedores no europeos (transferencias internacionales) ──
  if (nonEuTrackers.length > 0) {
    addFinding({
      checkId: 'T-002',
      severity: 'medium',
      category: 'third_parties',
      title: 'Servicios de terceros con posible transferencia internacional de datos detectados',
      evidence: nonEuProviders.length ? nonEuProviders : nonEuTrackers.slice(0, 6),
      recommendation: `Se han identificado servicios de terceros (${(nonEuProviders.length ? nonEuProviders : nonEuTrackers).join(', ')}) que podrían implicar transferencias o acceso por proveedores fuera del EEE. Esto requiere revisión técnica y legal antes de extraer conclusiones de cumplimiento.`,
      authority: 'GDPR Cap. V · EDPB Guidelines · AEPD Guía RGPD',
      confidence: 'medium',
      requiresLegalReview: true,
    });
  }

  const riskScoring = calculateRiskScoring(findings);
  const score = Math.max(0, 100 - riskScoring.riskScore);

  // Resumen
  const criticals = findings.filter(f => f.severity === 'critical');
  const highs = findings.filter(f => f.severity === 'high');
  const mediums = findings.filter(f => f.severity === 'medium');

  let riskLevel = riskScoring.band;

  let summary;
  if (riskLevel === 'critical' && criticals.length > 0) {
    summary = `El scanner detectó ${criticals.length} señal(es) técnica(s) de riesgo crítico: ${criticals.map(f => f.title.toLowerCase()).join('; ')}.`;
  } else if ((riskLevel === 'high' || riskLevel === 'critical') && highs.length > 0) {
    summary = `No se detectaron señales críticas, pero sí ${highs.length} señal(es) de riesgo alto que pueden requerir revisión: ${highs.map(f => f.title.toLowerCase()).join('; ')}.`;
  } else if (riskLevel === 'medium') {
    summary = 'Se detectaron señales técnicas con riesgo total medio. Revisa los riesgos principales y las observaciones adicionales antes de tomar decisiones.';
  } else {
    summary = 'No se detectaron señales técnicas de riesgo crítico o alto. Se identificaron algunos aspectos de severidad media o baja que merecen revisión.';
  }

  const contextualExplanation = buildContextualExplanation({
    trackerDomains, adTrackers, analyticsTrackers, nonEuTrackers,
    banner: data.banner, riskLevel,
  });

  for (const finding of findings) {
    finding.group = finding.group || getFindingGroup(finding);
  }

  return {
    score, riskScore: riskScoring.riskScore, band: riskScoring.band,
    scoring: riskScoring,
    riskLevel, summary, contextualExplanation, findings,
    trackerBreakdown: {
      advertising: adTrackers,
      analytics: analyticsTrackers,
      social: socialTrackers,
      tagmanager: tagManagers,
      nonEU: nonEuTrackers,
      nonEUProviders: nonEuProviders,
    },
  };
}

// ─── Explicación contextual ─────────────────────────────────────────────────

function buildContextualExplanation({ trackerDomains, adTrackers, analyticsTrackers, nonEuTrackers, banner, riskLevel }) {
  const parts = [];
  const nonEuProviders = getProviderNames(nonEuTrackers);

  if (adTrackers.length > 0) {
    parts.push(`La web parece cargar ${adTrackers.length} servicio(s) de publicidad o marketing antes de que el scanner detecte un consentimiento visible.`);
  } else if (analyticsTrackers.length > 0) {
    parts.push(`La web parece cargar herramientas de analítica antes de que el scanner detecte un consentimiento visible.`);
  }

  if (!banner.hasBanner && trackerDomains.length > 0) {
    parts.push('No se detectó ningún mecanismo de consentimiento activo durante el escaneo.');
  } else if (banner.hasCookieWall) {
    parts.push('Se detectó un posible muro de cookies que podría condicionar el acceso al contenido.');
  } else if (banner.hasBrowseConsent) {
    parts.push('Se detectó texto que sugiere que continuar navegando equivale a dar consentimiento, patrón considerado inválido por el EDPB y las autoridades nacionales.');
  } else if (banner.hasAcceptButton && !banner.hasRejectButton) {
    parts.push('Se detectó un banner, pero el scanner no encontró un botón de rechazo equivalente en primera capa.');
  } else if (banner.hasAcceptButton && banner.hasRejectButton) {
    parts.push('Se detectó un banner con opciones de aceptar y rechazar visibles.');
  }

  if (nonEuTrackers.length > 0) {
    parts.push(`Se detectaron ${nonEuTrackers.length} servicio(s) de proveedores con posible transferencia internacional de datos (${nonEuProviders.join(', ')}).`);
  }

  if (riskLevel === 'low') {
    parts.push('Los indicadores técnicos revisados no muestran señales de riesgo crítico o alto durante este escaneo.');
  }

  parts.push('Este análisis refleja solo el comportamiento observado en el momento del escaneo, desde esta ubicación y con este navegador. No es una conclusión legal. Se recomienda revisión con un DPO o asesor legal antes de tomar decisiones.');

  return parts.join(' ');
}

// ─── Función principal ──────────────────────────────────────────────────────

// ─── Multi-page discovery ────────────────────────────────────────────────────

// Rutas conocidas a priorizar en el crawl de subpáginas
const PRIORITY_SUBPATHS = [
  '/contacto', '/contact', '/kontakt',
  '/privacidad', '/privacy', '/privacybeleid', '/datenschutz',
  '/politica-de-cookies', '/politica-cookies', '/cookie-policy', '/cookies', '/cookiebeleid',
  '/aviso-legal', '/legal', '/terminos', '/terms', '/condiciones',
  '/checkout', '/cart', '/cesta', '/tienda', '/shop',
  '/blog', '/noticias', '/news',
  '/about', '/sobre-nosotros', '/quienes-somos',
];

/**
 * Descubre hasta maxPages URLs internas desde la página actual.
 * Prioriza rutas conocidas (contacto, privacidad, checkout, blog)
 * y completa con enlaces descubiertos desde el DOM.
 */
async function discoverSubpages(page, rootUrl, maxPages = 4) {
  const origin = new URL(rootUrl).origin;

  // Intentar extraer todos los hrefs de la página
  let discoveredHrefs = [];
  try {
    discoveredHrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href)
        .filter(h => h && !h.startsWith('#') && !h.startsWith('javascript:'))
    );
  } catch { /* non-critical */ }

  // Normalizar a pathname único del mismo origen
  const normalize = href => {
    try {
      const u = new URL(href);
      if (u.origin !== origin) return null;
      if (u.pathname === '/' || u.pathname === '') return null;
      return `${origin}${u.pathname.replace(/\/$/, '')}`;
    } catch { return null; }
  };

  const seen = new Set([rootUrl, `${origin}/`]);
  const result = [];

  const tryAdd = url => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push(url);
  };

  // 1. Rutas prioritarias conocidas
  for (const path of PRIORITY_SUBPATHS) {
    if (result.length >= maxPages) break;
    tryAdd(`${origin}${path}`);
  }

  // 2. Completar con enlaces descubiertos en el DOM
  for (const href of discoveredHrefs) {
    if (result.length >= maxPages) break;
    tryAdd(normalize(href));
  }

  return result.slice(0, maxPages);
}

/**
 * Escanea una subpágina dentro del contexto de navegador existente.
 * Retorna requests, trackers, cookies, forms y privacyLinks de esa página.
 */
async function scanSubpage(context, subUrl, trackerIntel, safeHostCache, startedAt) {
  const page = await context.newPage();
  const requests = [];
  const trackers = [];

  await page.route('**/*', async route => {
    const safe = await isSafePublicRequestUrl(route.request().url(), safeHostCache);
    if (!safe) return route.abort('blockedbyclient');
    return route.continue();
  });

  page.on('request', req => {
    const u = req.url();
    let hostname = '';
    try { hostname = new URL(u).hostname.toLowerCase(); } catch { /* ignore */ }
    requests.push({ url: u, type: req.resourceType(), timestampMs: Date.now() - startedAt, hostname, sourcePage: subUrl });
    if (isTrackerDomain(u) || isExternalTrackerDomain(hostname, trackerIntel)) trackers.push(u);
  });

  try {
    await page.goto(subUrl, { waitUntil: 'networkidle', timeout: 12000 }).catch(async () => {
      await page.goto(subUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
      await page.waitForTimeout(2000);
    });
    await page.waitForTimeout(1500);
  } catch { /* timeout o 404 — no crítico */ }

  let forms = { totalForms: 0, formsWithPersonalFields: 0, preCheckedMarketing: false, formsWithoutPrivacyLink: [] };
  let privacyLinks = { hasPrivacyLink: false, hasCookiePolicyLink: false };

  try { forms = await detectForms(page); } catch { /* ignore */ }
  try { privacyLinks = await detectPrivacyPolicy(page); } catch { /* ignore */ }

  const cookies = await context.cookies().catch(() => []);
  await page.close();

  return { url: subUrl, requests, trackers, cookies, forms, privacyLinks };
}

// ─── Main scanner ────────────────────────────────────────────────────────────

async function scanUrl(rawUrl, options = {}) {
  const startedAt = Date.now();
  const url = normalizeScanUrl(rawUrl);
  if (!(await isSafePublicRequestUrl(url, new Map()))) {
    throw new Error('No se pueden escanear URLs locales o privadas.');
  }
  const reportLanguage = resolveReportLanguage(options.reportLanguage);
  const marketProfile = resolveMarketProfile(options.market, reportLanguage);
  const isHttps = url.startsWith('https://');
  const observationWindowMs = Number(process.env.SCAN_OBSERVATION_MS || 2500);
  const maxExtraPages = Math.min(Number(process.env.SCAN_MAX_PAGES || 4), 9);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const trackerIntel = await loadTrackerIntel();
    const page = await context.newPage();
    const requests = [];
    const trackers = [];
    const safeHostCache = new Map();

    await page.route('**/*', async route => {
      const safe = await isSafePublicRequestUrl(route.request().url(), safeHostCache);
      if (!safe) return route.abort('blockedbyclient');
      return route.continue();
    });

    page.on('request', req => {
      const u = req.url();
      let hostname = '';
      try { hostname = new URL(u).hostname.toLowerCase(); } catch { /* ignore */ }
      requests.push({ url: u, type: req.resourceType(), timestampMs: Date.now() - startedAt, hostname, sourcePage: url });
      if (isTrackerDomain(u) || isExternalTrackerDomain(hostname, trackerIntel)) trackers.push(u);
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(3000);
    });
    if (observationWindowMs > 0) {
      await page.waitForTimeout(observationWindowMs);
    }

    // Screenshot de la portada (antes de cualquier interacción)
    let screenshotBase64 = null;
    try {
      const buf = await page.screenshot({ type: 'jpeg', quality: 55, clip: { x: 0, y: 0, width: 1280, height: 800 } });
      screenshotBase64 = buf.toString('base64');
    } catch { /* no crítico */ }

    const allCookiesRoot = await context.cookies();
    const banner = await detectCookieBanner(page);
    const privacyRoot = await detectPrivacyPolicy(page);
    const formsRoot = await detectForms(page);

    // ── Descubrir y escanear subpáginas ──────────────────────────────────────
    const subpageUrls = await discoverSubpages(page, url, maxExtraPages);
    const subpageResults = [];

    for (const subUrl of subpageUrls) {
      try {
        const sub = await scanSubpage(context, subUrl, trackerIntel, safeHostCache, startedAt);
        subpageResults.push(sub);
        requests.push(...sub.requests);
        trackers.push(...sub.trackers);
      } catch { /* fallo en página individual — no crítico */ }
    }

    await browser.close();

    // ── Agregar datos de todas las páginas ───────────────────────────────────

    // Cookies: deduplicar por nombre+dominio
    const allCookiesRaw = [...allCookiesRoot, ...subpageResults.flatMap(s => s.cookies)];
    const cookieSeen = new Set();
    const allCookies = allCookiesRaw.filter(c => {
      const key = `${c.name}@${c.domain}`;
      if (cookieSeen.has(key)) return false;
      cookieSeen.add(key);
      return true;
    });

    const trackingCookiesBefore = allCookies
      .filter(c => isTrackingCookie(c.name))
      .map(c => c.name);
    const cookieAttributes = analyzeCookieAttributes(allCookies);

    // Privacidad: presente si se detecta en cualquier página
    const privacy = {
      ...privacyRoot,
      hasPrivacyLink: privacyRoot.hasPrivacyLink || subpageResults.some(s => s.privacyLinks.hasPrivacyLink),
      hasCookiePolicyLink: privacyRoot.hasCookiePolicyLink || subpageResults.some(s => s.privacyLinks.hasCookiePolicyLink),
    };

    // Formularios: agregado del peor caso entre todas las páginas
    const allFormsData = [formsRoot, ...subpageResults.map(s => s.forms)];
    const forms = {
      totalForms: allFormsData.reduce((sum, f) => sum + (f.totalForms || 0), 0),
      formsWithPersonalFields: allFormsData.reduce((sum, f) => sum + (f.formsWithPersonalFields || 0), 0),
      preCheckedMarketing: allFormsData.some(f => f.preCheckedMarketing),
      formsWithoutPrivacyLink: allFormsData.flatMap(f => f.formsWithoutPrivacyLink || []),
    };

    const thirdPartyDomainList = getThirdPartyDomains(requests, url);
    const thirdPartyDomains = thirdPartyDomainList.length;

    // Lista de páginas escaneadas para metadata
    const pagesScanned = [url, ...subpageResults.map(s => s.url)];

    const analysis = calculateScore({
      url, isHttps, trackers, trackingCookiesBefore, cookieAttributes,
      banner, privacy, forms, thirdPartyDomains, requests,
    });
    const documentationDiscrepancy = buildDocumentationDiscrepancy({
      banner, privacy, trackers, trackingCookiesBefore,
    });

    const payload = {
      url,
      scannedAt: new Date().toISOString(),
      scanMetadata: {
        userAgent: 'Chrome/122 headless',
        region: 'EU (server location)',
        contextClean: true,
        observationWindowMs,
        durationMs: Date.now() - startedAt,
        pagesScanned,
        totalPagesScanned: pagesScanned.length,
      },
      reportLanguage,
      marketProfile,
      score: analysis.score,
      riskScore: analysis.riskScore,
      band: analysis.band,
      scoring: analysis.scoring,
      riskLevel: analysis.riskLevel,
      summary: analysis.summary,
      contextualExplanation: analysis.contextualExplanation,
      scoreExplanation: 'El privacy technical health score refleja señales técnicas automatizadas observadas durante el risk scan. Un score más bajo indica mayor riesgo técnico. No representa una evaluación legal completa.',
      findings: analysis.findings,
      trackerBreakdown: analysis.trackerBreakdown,
      documentationDiscrepancy,
      meta: {
        totalRequests: requests.length,
        thirdPartyDomains,
        thirdPartyDomainsFound: thirdPartyDomainList,
        trackingCookiesFound: trackingCookiesBefore,
        trackerDomainsFound: [...new Set(trackers.map(getTrackerDomain))],
        bannerDetected: banner.hasBanner,
        privacyLinkDetected: privacy.hasPrivacyLink,
        cookiePolicyDetected: privacy.hasCookiePolicyLink,
        totalForms: forms.totalForms,
        cookieDetails: allCookies.map(c => ({
          name: c.name,
          domain: c.domain,
          path: c.path,
          expires: c.expires,
          secure: c.secure,
          sameSite: c.sameSite,
        })),
        cmpDetected: cmpNameFromBanner(banner),
        trackerIntel: {
          source: trackerIntel.source,
          loaded: trackerIntel.loaded,
          domains: trackerIntel.domains.length,
        },
        pagesScanned,
        totalPagesScanned: pagesScanned.length,
        screenshotBase64,
      },
      riskType: 'technical_risk',
      requiresLegalReview: analysis.findings.some(f => f.requiresLegalReview),
      recommendedNextSteps: [
        'Revisar los riesgos principales con el responsable de la web, el responsable del gestor de etiquetas y el DPO/asesor de privacidad.',
        'Bloquear analítica, publicidad y píxeles sociales hasta que exista la señal de consentimiento correspondiente.',
        'Comprobar si aplica una exención documentada de analítica de bajo impacto.',
        'Verificar que la primera capa del banner ofrece aceptar, rechazar y configurar con visibilidad comparable.',
        'Alinear la política de privacidad/cookies con los trackers, cookies y proveedores realmente detectados.',
        'Ejecutar un nuevo risk scan tras la corrección y conservar ambos informes como evidencia técnica.',
      ],
      scanLimitations: [
        `Páginas analizadas: ${pagesScanned.length} (portada + subpáginas descubiertas automáticamente). No se garantiza cobertura completa del sitio.`,
        'Client-side scan only — server-side tagging (SST) may hide additional trackers.',
        'Google Consent Mode v2 behavior depends on site configuration and cannot be fully verified client-side.',
        'Dark pattern assessment is heuristic and may require human UX review.',
        `Región/IP usada: ${marketProfile.label} desde la infraestructura donde se ejecuta este servidor; no equivale necesariamente a la ubicación real del visitante.`,
        'Navegador usado: Chromium headless con contexto limpio.',
        'No se accedió como usuario registrado ni se probaron áreas privadas.',
        'Los resultados pueden variar por geolocalización, idioma, dispositivo, consentimiento previo, A/B testing o cambios posteriores del sitio.',
      ],
      disclaimer: `Este informe tiene carácter informativo y técnico. No constituye asesoramiento legal ni certifica el cumplimiento de ninguna norma. Las conclusiones se basan en evidencias automatizadas durante el risk scan y pueden no reflejar cambios posteriores. Perfil aplicado: ${marketProfile.label}. Se recomienda revisar estos resultados con el Delegado de Protección de Datos (DPO) o un asesor jurídico especializado.`,
    };
    const localizedPayload = localizeOutput(payload, reportLanguage);
    localizedPayload.apiReport = buildApiReport(localizedPayload);
    return localizedPayload;
  } catch (err) {
    await browser.close();
    throw err;
  }
}


module.exports = { scanUrl };
