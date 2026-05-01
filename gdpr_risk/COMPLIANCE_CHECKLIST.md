# Checklist de compliance GDPR / ePrivacy — Privacy Risk Scanner
**Fase:** Evaluación inicial  
**Fecha:** 2026-05-01  
**Alcance:** La herramienta como servicio web (server.js, scanner.js, public/index.html)  
**Metodología:** Revisión directa del código fuente + criterios RGPD / Directiva ePrivacy / EDPB

> **Leyenda de estado:**  
> ✅ Pasa · ⚠️ Riesgo parcial · ❌ Fallo · 🔲 No aplica en MVP · 📋 Pendiente documentar

---

## 1. Transparencia e información (Arts. 13–14 RGPD)

| ID | Control | Estado | Evidencia en código | Acción recomendada |
|----|---------|--------|--------------------|--------------------|
| T-01 | La herramienta dispone de política de privacidad accesible para el usuario final | ❌ | No existe ningún fichero ni enlace a política de privacidad en `public/index.html` | Redactar y publicar política de privacidad en `/privacy` o modal accesible desde el footer |
| T-02 | Se informa al usuario de qué datos se recogen (IP, URL analizada, logs) | ❌ | El disclaimer existente sólo cubre el alcance del informe de escaneo, no el tratamiento de datos del propio usuario | Añadir aviso de tratamiento antes del formulario de escaneo |
| T-03 | Se informa de la finalidad del tratamiento | ❌ | Sin documentar | Incluir en política de privacidad: finalidades (escaneo técnico, rate limiting, logs de operación) |
| T-04 | Se informa del responsable del tratamiento y datos de contacto | ❌ | Sin identificación de responsable en ningún fichero público | Identificar el responsable y añadir email de contacto en la política |
| T-05 | Se informa del plazo de conservación de los datos | ❌ | `scanQueue` (IPs) se conserva en memoria hasta TTL de 5s. Los logs de consola no tienen TTL definido | Documentar retención: IPs en memoria (TTL actual: 5s), logs de operación (definir y documentar) |
| T-06 | Se informa de la base jurídica del tratamiento | ❌ | Sin documentar | Ver sección 2 |

---

## 2. Base jurídica del tratamiento (Art. 6 RGPD)

La herramienta realiza los siguientes tratamientos. Ninguno tiene base jurídica documentada:

| ID | Actividad de tratamiento | Dato personal implicado | Base jurídica propuesta | Estado |
|----|--------------------------|------------------------|------------------------|--------|
| BJ-01 | Rate limiting por IP | Dirección IP (dato personal bajo RGPD / TJUE C-582/14) | Interés legítimo (Art. 6.1.f) — seguridad del servicio | ⚠️ No documentada |
| BJ-02 | Logs de operación en consola (`console.log` con IP, URL, score, timestamp) | IP + URL analizada | Interés legítimo (Art. 6.1.f) — operación y depuración | ⚠️ No documentada |
| BJ-03 | Actividad de escaneo iniciada por el usuario | URL enviada por el usuario (puede identificar a personas si es una web personal) | Ejecución del servicio solicitado (Art. 6.1.b) o consentimiento (Art. 6.1.a) | ⚠️ No documentada |
| BJ-04 | Captura de screenshot de la web analizada | Screenshot puede contener datos personales visibles (nombres, emails, fotos en webs escaneadas) | Interés legítimo del usuario solicitante | ⚠️ Alto riesgo — ver C-01 |

**Acción:** Documentar base jurídica para cada actividad en la política de privacidad y, si aplica, en el Registro de Actividades de Tratamiento (ROPA).

---

## 3. Datos personales tratados por la herramienta

| ID | Dato | Origen | Dónde se almacena | Retención actual | ¿Se comunica a terceros? |
|----|------|--------|-------------------|-----------------|--------------------------|
| D-01 | Dirección IP del solicitante | Cabecera HTTP | `scanQueue` Map (memoria, proceso Node.js) | TTL 5 segundos (limpieza automática en `server.js:116`) | No |
| D-02 | URL analizada | Body del POST `/scan` | Logs de consola (`console.log`) + memoria durante el escaneo | Hasta reinicio del proceso (logs) + duración del escaneo (memoria) | No |
| D-03 | Timestamp del escaneo | Generado internamente | Logs de consola + respuesta JSON al cliente | Hasta reinicio del proceso (logs) | Sí — devuelto al cliente en `scannedAt` |
| D-04 | Screenshot de la web analizada (JPEG base64) | Playwright screenshot de la URL analizada | Memoria durante el escaneo → devuelto al cliente, no persistido en servidor | Solo durante el escaneo (< 30s) | Sí — devuelto al cliente en `meta.screenshotBase64` |
| D-05 | Datos de cookies y trackers de la web analizada | Playwright interception | Memoria durante el escaneo → devuelto al cliente | Solo durante el escaneo | Sí — devuelto al cliente en `findings`, `meta` |

**Observación positiva:** La herramienta **no persiste datos en base de datos**, no usa almacenamiento de ficheros para resultados y no envía datos a servicios de terceros propios. El riesgo de exposición se limita al proceso activo.

---

## 4. Actividad de escaneo como tratamiento de terceros (Art. 28 RGPD)

| ID | Control | Estado | Detalle |
|----|---------|--------|---------|
| E-01 | ¿El escaneo de webs de terceros constituye tratamiento de datos personales? | ⚠️ | El scanner accede a webs que pueden contener datos personales (páginas de login, perfiles de usuario, formularios). El screenshot captura lo que está visible. Hay que considerar si la herramienta actúa como encargada de tratamiento o solo como herramienta técnica del usuario |
| E-02 | ¿Se avisa al usuario de que la herramienta puede capturar datos personales visibles en la web analizada? | ❌ | No existe aviso. Recomendado añadir en el disclaimer de resultados |
| E-03 | ¿Se limita la captura de screenshot a la viewport inicial antes de interacción? | ✅ | `scanner.js:1682` — screenshot de `1280×800px` del estado inicial, no se hace scroll ni se interactúa |
| E-04 | ¿Se bloquean URLs locales/privadas para evitar SSRF y acceso a intranets? | ✅ | `server.js:55-57` — `blockedHosts` incluye localhost, 127.0.0.1, .local. `scanner.js:isSafePublicRequestUrl` amplía estos checks |
| E-05 | ¿El User-Agent identifica la herramienta como bot/scanner? | ⚠️ | Revisar si el User-Agent de Playwright es genérico o si se ha personalizado. Es buena práctica identificar el bot para que los webmasters puedan excluirlo de logs |

---

## 5. Frontend / interfaz web — ePrivacy y cookies

| ID | Control | Estado | Evidencia | Acción |
|----|---------|--------|-----------|--------|
| F-01 | La herramienta no instala cookies de tracking propias en el navegador del usuario | ✅ | `server.js` no emite ninguna cabecera `Set-Cookie`. La UI es HTML estático sin sesión | Verificar en DevTools al usar la herramienta — ninguna cookie debe aparecer |
| F-02 | La herramienta no carga trackers de terceros (Analytics, píxeles publicitarios) | ✅ | `public/index.html` solo carga `jspdf` desde `cdnjs.cloudflare.com`. No hay scripts de GA, Meta, Hotjar, etc. | Mantener. Añadir un chequeo en CI si se amplía el frontend |
| F-03 | Las cookies estrictamente necesarias (si las hubiera) están documentadas | 🔲 | No hay cookies propias en el MVP | Sin acción necesaria en MVP |
| F-04 | El banner de disclaimer en la UI usa lenguaje técnico correcto (no afirma cumplimiento) | ✅ | El disclaimer en `index.html` usa "señales técnicas visibles" y "no constituye asesoramiento legal" | Correcto. Mantener consistencia con el disclaimerText generado por scanner.js |
| F-05 | El Content-Security-Policy (CSP) está configurado | ❌ | `server.js` usa `cors()` pero no hay cabeceras CSP, X-Frame-Options ni X-Content-Type-Options | Añadir `helmet` o cabeceras manuales. Mínimo recomendado: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |
| F-06 | El formulario de escaneo no recoge datos personales del usuario más allá de la URL | ✅ | Solo `url`, `reportLanguage` y `market` en el body del POST. No hay campos de nombre, email, etc. | Mantener |

---

## 6. Seguridad del tratamiento (Art. 32 RGPD)

| ID | Control | Estado | Evidencia | Acción |
|----|---------|--------|-----------|--------|
| S-01 | La comunicación se realiza sobre HTTPS (en producción) | ⚠️ | El servidor Express no gestiona TLS directamente. En desarrollo arranca en HTTP. Depende de que el despliegue use un reverse proxy (Nginx, Caddy) con TLS | Documentar requisito de TLS en el README de despliegue. Añadir redirección HTTP→HTTPS si se despliega directamente |
| S-02 | Las IPs de los clientes se almacenan solo en memoria y con TTL | ✅ | `scanQueue` Map con limpieza automática cada 60s (`RATE_LIMIT_TTL_MS = 5000`, limpieza periódica en `server.js:113-118`) | Correcto. Documentar en política de privacidad |
| S-03 | Los resultados del escaneo no se persisten en servidor | ✅ | No hay escritura a fichero ni base de datos en `scanner.js` ni `server.js` | Mantener como principio de privacy by design |
| S-04 | El screenshot se genera en memoria y no se escribe a disco | ✅ | `page.screenshot()` devuelve `Buffer` → `toString('base64')`. No hay `writeFile` | Mantener |
| S-05 | Existe protección contra abuso (rate limiting) | ✅ | Rate limiting por IP cada 5s en `server.js:60-67` | Considerar ampliar a rate limiting por ventana más larga en producción |
| S-06 | Existen cabeceras de seguridad HTTP (CSP, HSTS, X-Frame-Options) | ❌ | Sin configurar en `server.js` | Añadir `helmet` npm package: `app.use(helmet())` |
| S-07 | Se validan y sanean las URLs de entrada | ✅ | `server.js:43-57` — validación con `new URL()`, bloqueo de hosts locales, comprobación de longitud y tipo | Correcto |
| S-08 | El proceso Playwright corre con permisos mínimos | ⚠️ | No se especifican flags de sandboxing explícitos en `playwright.launch()`. En Docker o CI puede necesitar `--no-sandbox` | Si se despliega en contenedor, documentar flags necesarios y sus implicaciones de seguridad |

---

## 7. Registro de actividades de tratamiento (Art. 30 RGPD)

| ID | Control | Estado | Acción |
|----|---------|--------|--------|
| R-01 | Existe un ROPA (Registro de Actividades de Tratamiento) | ❌ | No existe ningún documento ROPA | Crear ROPA mínimo con: responsable, finalidad, categorías de datos, base jurídica, retención, destinatarios, medidas de seguridad. Ver plantilla en sección 9 |
| R-02 | Las actividades de tratamiento del scanner están documentadas en el ROPA | ❌ | Ver D-01 a D-05 | Incluir las 4 actividades identificadas en sección 3 |

---

## 8. Transferencias internacionales (Arts. 44–49 RGPD)

| ID | Control | Estado | Evidencia | Acción |
|----|---------|--------|-----------|--------|
| TI-01 | La dependencia `playwright` descarga Chromium desde servidores de Google | ⚠️ | Solo en instalación (`npm run install:browsers`). No durante la ejecución del escaneo | Documentar que Chromium se descarga en el momento de instalación. En entornos air-gapped, la instalación debe realizarse previamente |
| TI-02 | El CDN `cdnjs.cloudflare.com` (jsPDF) puede implicar transferencia de datos del navegador del usuario | ⚠️ | El navegador del usuario hace una petición GET a Cloudflare (empresa con sede en EE.UU.) para cargar jsPDF. La IP del usuario se expone a Cloudflare | Considerar alojar jsPDF localmente (`vendor/jspdf.min.js`) para eliminar esta transferencia. Alternativa: documentar en política de privacidad |
| TI-03 | El servidor no realiza llamadas salientes a APIs externas propias | ✅ | Scanner solo hace peticiones a la URL analizada (iniciadas por el usuario). No hay llamadas a APIs de analytics, logging externo, etc. | Mantener |

---

## 9. Controles organizativos

| ID | Control | Estado | Acción |
|----|---------|--------|--------|
| O-01 | Existe una política de privacidad pública | ❌ | Ver T-01 | Redactar. Ver borrador en sección 10 |
| O-02 | Existe un DPO o punto de contacto para ejercicio de derechos | ❌ | Sin identificar | Añadir email de contacto. Para MVP: un alias `privacidad@[dominio]` es suficiente |
| O-03 | Existe un procedimiento documentado para responder a derechos de interesados (acceso, supresión, portabilidad) | ❌ | Sin documentar | Dada la arquitectura sin persistencia, la respuesta a casi todos los derechos es automática ("no conservamos datos"). Documentarlo explícitamente |
| O-04 | Existe un procedimiento de notificación de brechas de seguridad (Art. 33 RGPD, 72h) | ❌ | Sin documentar | Documentar procedimiento mínimo. Para MVP: identificar quién notifica a la AEPD y cómo |
| O-05 | Se ha realizado una Evaluación de Impacto (EIPD / DPIA) | 🔲 | Probablemente no obligatoria para MVP dado el bajo riesgo y ausencia de persistencia | Revisar si escala. Si el servicio procesa datos de empleados, menores o datos sensibles en las URLs escaneadas, puede activarse el umbral del Art. 35 |

---

## 10. Resumen ejecutivo — Estado del compliance

### Distribución de hallazgos

| Severidad | Nº | Controles |
|-----------|-----|-----------|
| ❌ Fallo (acción requerida) | 9 | T-01, T-02, T-03, T-04, T-05, T-06, F-05, S-06, R-01, R-02, O-01, O-02, O-03, O-04 |
| ⚠️ Riesgo parcial (revisar) | 7 | BJ-01, BJ-02, BJ-03, BJ-04, E-01, E-02, E-05, S-01, S-08, TI-01, TI-02 |
| ✅ Pasa | 10 | E-03, E-04, F-01, F-02, F-04, F-06, S-02, S-03, S-04, S-05, S-07, TI-03 |

### Fortalezas actuales (privacy by design)
- No persistencia de datos en servidor
- No cookies propias
- No trackers de terceros en el frontend
- Rate limiting con TTL corto
- Validación de URLs de entrada
- Screenshots no se escriben a disco

### Top 5 acciones prioritarias

| Prioridad | Acción | Esfuerzo estimado |
|-----------|--------|-------------------|
| 1 | Redactar y publicar política de privacidad (cubre T-01 a T-06, O-01) | 2–4h |
| 2 | Alojar jsPDF localmente para eliminar transferencia a Cloudflare (TI-02) | 30min |
| 3 | Añadir cabeceras de seguridad HTTP con `helmet` (F-05, S-06) | 30min |
| 4 | Crear ROPA mínimo (R-01, R-02) | 2h |
| 5 | Añadir aviso en resultados sobre posibles datos personales en screenshots (E-02) | 30min |

---

## 11. Borrador de clausulado mínimo para la política de privacidad

```
POLÍTICA DE PRIVACIDAD — Privacy Risk Scanner

Responsable del tratamiento: [Nombre/Entidad] · [email de contacto]

Datos que tratamos:
- Dirección IP: utilizada exclusivamente para limitar el número de escaneos
  por usuario (rate limiting). Retención: máximo 5 segundos en memoria.
  No se persiste en disco ni se comunica a terceros.
- URL analizada y timestamp: registrados en logs de operación del servidor
  durante la sesión activa. No se almacenan en base de datos.
- Captura de pantalla de la web analizada: generada en memoria durante el
  escaneo, devuelta al solicitante y eliminada del servidor inmediatamente.
  Puede contener datos visibles en la web analizada.

Finalidad y base jurídica:
- Prestación del servicio de escaneo técnico solicitado (Art. 6.1.b RGPD)
- Seguridad y prevención de abuso del servicio (Art. 6.1.f RGPD —
  interés legítimo)

Derechos de los interesados: Dado que no conservamos datos personales más
allá de la sesión activa, el ejercicio de los derechos de acceso, supresión
y portabilidad resulta materialmente vacío de contenido. Para cualquier
consulta: [email de contacto]

Aviso sobre contenidos escaneados: La herramienta accede a la URL que usted
introduce y puede capturar una imagen de su estado inicial. Si la URL
contiene datos personales visibles, esos datos se mostrarán en el informe
generado en su navegador y no serán almacenados por este servicio.
```

---

*Documento generado como evaluación inicial. Debe ser revisado por un DPO o asesor jurídico especializado antes de su uso como base de cumplimiento formal.*
