# Privacy Risk Scanner — MVP

> Identifica señales técnicas visibles de posible desalineación con las normas de cookies, ePrivacy y GDPR en cualquier URL pública. Orientado al mercado europeo (ES · EN · NL).

**⚠️ Aviso legal:** Este análisis identifica señales técnicas visibles. No constituye asesoramiento legal ni certifica cumplimiento normativo. Los resultados deben revisarse con un DPO o asesor jurídico especializado.

---

## Instalación

### Requisitos previos
- Node.js 18+ ([descargar](https://nodejs.org))
- npm (incluido con Node.js)

### Pasos

```bash
# 1. Entrar en la carpeta del proyecto
cd gdpr_risk

# 2. Instalar dependencias
npm install

# 3. Instalar el navegador Chromium para Playwright (solo la primera vez)
npm run install:browsers

# 4. Iniciar el servidor
npm start
```

El servidor arranca en **http://localhost:3000**

---

## Variables de entorno

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `SCAN_OBSERVATION_MS` | `2500` | Tiempo de observación adicional tras `networkidle` (ms) |
| `SCAN_MAX_PAGES` | `4` | Número máximo de subpáginas a escanear (además de la portada). Máximo permitido: 9 |

---

## Uso

### Desde el navegador (UI)

1. Abre http://localhost:3000
2. Selecciona el idioma del informe (Español / English / Nederlands) y el perfil regulatorio (UE general / España-AEPD / Netherlands AP+ACM)
3. Introduce la URL a analizar (ej: `https://example.com`)
4. Pulsa **"Escanear web"**
5. El resultado muestra el **privacy technical health score** (0–100), nivel de technical risk, desglose de trackers por tipo, hallazgos con checkId y nivel de confianza, recomendaciones, próximos pasos y captura de pantalla
6. Exporta el informe completo en **PDF** o descárgalo en **JSON**

El idioma del informe también puede detectarse automáticamente desde `navigator.language` y la timezone del navegador.

### Desde la línea de comandos

```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "reportLanguage": "es", "market": "es"}'
```

Parámetros opcionales del body:

| Campo | Valores | Por defecto |
|-------|---------|-------------|
| `reportLanguage` | `"es"`, `"en"`, `"nl"` | `"es"` |
| `market` | `"es"`, `"nl"`, `"eu"` | inferido de `reportLanguage` |

### Con PowerShell (Windows)

```powershell
$body = '{"url": "https://example.com", "reportLanguage": "es", "market": "es"}'
Invoke-RestMethod -Uri http://localhost:3000/scan -Method POST -Body $body -ContentType "application/json"
```

---

## Ejemplo de respuesta

```json
{
  "url": "https://example.com",
  "scannedAt": "2026-05-01T10:00:00.000Z",
  "score": 58,
  "riskScore": 42,
  "riskLevel": "high",
  "reportLanguage": "es",
  "marketProfile": { "code": "es", "label": "España / AEPD" },
  "summary": "Cookies publicitarias detectadas antes del consentimiento. No hay botón de rechazar visible en primera capa.",
  "scoreExplanation": "El privacy technical health score refleja señales técnicas automatizadas observadas durante el risk scan. Un score más bajo indica mayor riesgo técnico. No representa una evaluación legal completa.",
  "contextualExplanation": "...",
  "requiresLegalReview": true,
  "findings": [
    {
      "checkId": "C-002",
      "severity": "critical",
      "category": "cookies",
      "title": "Cookies publicitarias detectadas en la carga inicial",
      "evidence": ["_fbp", "_gcl_au"],
      "recommendation": "Bloquear cookies publicitarias hasta obtener consentimiento explícito.",
      "authority": "EDPB / ePrivacy / GDPR Art. 6",
      "confidence": "high",
      "requiresLegalReview": true
    },
    {
      "checkId": "B-002",
      "severity": "high",
      "category": "cookie_banner",
      "title": "Banner con botón 'Aceptar' pero sin opción 'Rechazar' equivalente visible en primera capa",
      "evidence": ["Botón 'Aceptar' detectado: 'Accept all'"],
      "recommendation": "El botón de rechazo debe ser igual de prominente que el de aceptación en la primera capa.",
      "authority": "EDPB Guidelines 03/2022",
      "confidence": "high",
      "requiresLegalReview": true
    }
  ],
  "trackerBreakdown": {
    "advertising": ["facebook.net", "doubleclick.net"],
    "analytics": ["google-analytics.com"],
    "social": [],
    "tagmanager": ["googletagmanager.com"],
    "nonEU": ["facebook.net", "google-analytics.com"]
  },
  "meta": {
    "totalRequests": 87,
    "thirdPartyDomains": 14,
    "pagesScanned": ["https://example.com", "https://example.com/contact", "https://example.com/privacy"],
    "totalPagesScanned": 3,
    "trackingCookiesFound": ["_fbp", "_ga"],
    "trackerDomainsFound": ["facebook.net", "google-analytics.com"],
    "bannerDetected": true,
    "privacyLinkDetected": true,
    "cookiePolicyDetected": false,
    "totalForms": 2,
    "screenshotBase64": "..."
  },
  "scanLimitations": [
    "Análisis realizado desde contexto de navegador limpio (sin sesión previa).",
    "Navegador usado: Chromium headless con contexto limpio.",
    "No se accedió como usuario registrado ni se probaron áreas privadas.",
    "Páginas analizadas: portada + hasta 4 subpáginas descubiertas automáticamente (configurable con SCAN_MAX_PAGES). No se garantiza cobertura completa.",
    "Los resultados pueden variar por geolocalización, idioma, dispositivo, consentimiento previo, A/B testing o cambios posteriores del sitio."
  ],
  "recommendedNextSteps": ["..."],
  "disclaimer": "Este informe tiene carácter informativo y técnico. No constituye asesoramiento legal ni certifica el cumplimiento de ninguna norma. Perfil aplicado: España / AEPD. Se recomienda revisar con el DPO o un asesor jurídico especializado."
}
```

El campo `apiReport` en la respuesta contiene un resumen plano orientado a integraciones programáticas.

---

## Checks implementados

### Cookies y trackers (C-*)

| Check ID | Título | Severidad |
|----------|--------|-----------|
| S-001 | La web no utiliza HTTPS | Crítica |
| C-001 | Cookies de analítica detectadas en la carga inicial | Crítica |
| C-001b | Herramientas de analítica detectadas sin mecanismo de consentimiento visible | Alta |
| C-002 | Cookies publicitarias detectadas en la carga inicial | Crítica |
| C-003 | Scripts/píxeles publicitarios cargados sin mecanismo de consentimiento visible | Crítica / Alta |
| C-004 | Google Tag Manager detectado sin banner de consentimiento activo | Alta |
| C-005 | Meta Pixel detectado antes de interacción con el consentimiento | Crítica |
| C-006 | LinkedIn Insight Tag detectado antes de interacción con el consentimiento | Alta |
| C-007 | Herramientas de heatmap o sesión detectadas antes del consentimiento | Alta |
| C-009 | Cookies no esenciales con duración superior a 13 meses detectadas | Media |
| C-010 | Cookies sin atributo Secure detectadas | Baja |

### Banner de cookies (B-*)

| Check ID | Título | Severidad |
|----------|--------|-----------|
| B-001 | No se detectó mecanismo de consentimiento activo pese a haber actividad de terceros | Crítica |
| B-001 | No se detectó banner de cookies durante el escaneo | Baja |
| B-002 | Banner con botón "Aceptar" pero sin opción "Rechazar" equivalente visible en primera capa | Alta |
| B-002 | Banner con opciones de aceptar y rechazar detectadas en primera capa | OK |
| B-003 | Rechazar cookies requiere navegar a "Configurar preferencias" (segunda capa) | Media |
| B-004 | Casillas de consentimiento para cookies no esenciales pre-marcadas detectadas | Alta |
| B-005 | Texto que indica que seguir navegando implica consentimiento | Alta |
| B-006 | Posible muro de cookies detectado que podría bloquear el acceso al contenido | Crítica |

### Política de privacidad (P-*)

| Check ID | Título | Severidad |
|----------|--------|-----------|
| P-001 | No se detectó enlace visible a política de privacidad | Alta |
| P-001 | Enlace a política de privacidad detectado | OK |
| P-002 | No se detectó enlace separado a política de cookies | Alta / Media |

### Formularios (F-*)

| Check ID | Título | Severidad |
|----------|--------|-----------|
| F-001 | Formulario(s) con campos personales sin enlace a política de privacidad visible | Media |
| F-002 | Casillas de marketing/newsletter pre-marcadas detectadas en formularios | Alta |

### Terceros (T-*)

| Check ID | Título | Severidad |
|----------|--------|-----------|
| T-001 | Número elevado de dominios de terceros detectados durante el escaneo | Media |
| T-002 | Servicios de terceros con posible transferencia internacional de datos detectados | Media |

---

## Scoring

El producto comunica el número principal como **privacy technical health score** (`score`, 0–100). Un valor más alto indica mejor postura técnica observada; un valor bajo indica mayor technical risk.

Internamente se calcula también el `riskScore` (0–100, donde mayor = más riesgo). La deducción por finding usa el peor hallazgo único por checkId:

| Severidad | Peso |
|-----------|------|
| critical  | −20 pts |
| high      | −10 pts |
| medium    | −5 pts |
| low       | −2 pts |

Se aplica un **bonus de +30 pts de riesgo** cuando coinciden B-001 (sin banner) y trackers publicitarios críticos simultáneamente (C-002, C-005 o C-006).

| Privacy technical health score | Nivel de technical risk |
|-------------------------------|------------------------|
| 80–100 | Bajo |
| 50–79  | Medio |
| 20–49  | Alto |
| 0–19   | Crítico |

---

## Desglose de trackers por tipo (`trackerBreakdown`)

El scanner clasifica cada dominio de terceros detectado en las siguientes categorías:

| Clave | Descripción |
|-------|-------------|
| `advertising` | Cookies/scripts publicitarios y de remarketing |
| `analytics`   | Herramientas de analítica web |
| `social`      | Píxeles y SDKs de redes sociales |
| `tagmanager`  | Gestores de etiquetas (GTM, etc.) |
| `nonEU`       | Proveedores con posible transferencia internacional fuera de la UE |

---

## Idiomas y perfiles regulatorios

La UI detecta automáticamente el idioma del navegador y la timezone. El informe, los hallazgos, las recomendaciones, los próximos pasos, las limitaciones y el disclaimer se generan en el idioma seleccionado.

| Idioma | Código | Perfil regulatorio disponible |
|--------|--------|-------------------------------|
| Español | `es` | España / AEPD |
| English | `en` | UE general |
| Nederlands | `nl` | Netherlands / AP + ACM |

---

## Uso comercial / outreach

Para email u outreach inicial, no enviar el PDF completo gratis. Enviar solo un resumen ejecutivo y un máximo de 2 hallazgos relevantes; reservar el informe completo para cliente cualificado, demo acordada o entrega pagada.

---

## Estructura del proyecto

```
gdpr_risk/
├── server.js        ← Express API + servidor estático
├── scanner.js       ← Motor de escaneo con Playwright (i18n ES/EN/NL, perfiles ES/NL/EU)
├── public/
│   └── index.html   ← Frontend completo (UI dark-mode, i18n, PDF export, selector de mercado)
├── package.json
├── .gitignore
└── README.md
```

---

## Limitaciones del MVP

1. **Sin caché**: cada escaneo lanza un navegador nuevo. Para producción, usar un pool de browsers.
2. **Sin login de usuarios**: no hay autenticación.
3. **Sin base de datos**: los resultados no se persisten.
4. **Sin análisis de segundo clic**: no se simula el click en "rechazar" para un segundo escaneo comparativo.
5. **Heurísticas de banner**: detección por texto y selectores CSS. Puede haber falsos negativos en banners muy personalizados.
6. **Timeout**: sitios muy lentos (>15 s) pueden dar error de timeout.
7. **Crawl de subpáginas limitado**: se analizan automáticamente hasta 5 páginas (portada + 4 subpáginas descubiertas). No se garantiza cobertura completa; sitios con rutas no estándar pueden quedar fuera del crawl.
8. **Sin soporte para SPAs con carga diferida**: algunos trackers se cargan después del evento `networkidle`.
9. **Geolocalización**: el análisis se realiza desde la IP del servidor, no desde la IP del visitante real. Los resultados pueden variar por geo, A/B testing o consentimiento previo.
10. **Análisis legal**: este scanner NO determina cumplimiento legal. Solo detecta señales técnicas visibles.

---

## Webs sugeridas para test manual

```
# Web con Cookiebot
https://cookiebot.com

# Web con OneTrust
https://onetrust.com

# E-commerce con Google Analytics
https://woocommerce.com

# Web WordPress pequeña
https://wordpress.org

# Web sin banner (probable riesgo crítico)
Busca una web local pequeña sin CMP
```

---

## Próximas features (backlog v2)

- [ ] Segundo escaneo tras click en "rechazar" para comparar cookies antes/después
- [ ] Detección de Google Consent Mode v2
- [ ] Historial de escaneos (localStorage o BD)
- [ ] API key para uso programático
- [ ] Pool de browsers Playwright (mejor rendimiento)
- [x] Análisis de subpáginas (checkout, contacto, blog) — **implementado en v0.2**
- [ ] Soporte SPAs con carga diferida post-`networkidle`
- [ ] Comparativa documentación vs implementación técnica (campo `documentationDiscrepancy` ya en el schema de respuesta)
