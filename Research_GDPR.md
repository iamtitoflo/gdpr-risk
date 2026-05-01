<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

## Resumen ejecutivo

Privacy Risk Scanner puede posicionarse como un “scanner técnico de riesgos de cookies y privacidad” que traduce requisitos de GDPR, Directiva ePrivacy, guías del EDPB, AEPD, AP y ACM en checks automatizables sobre cookies, scripts, banners y formularios, sin hacer juicios de cumplimiento jurídico.[^1][^2][^3]

La clave de producto es: 1) detectar evidencia técnica de posibles incumplimientos (cookies/trackers antes del consentimiento, dark patterns, falta de enlaces, terceros de alto riesgo), 2) clasificarla en niveles de riesgo técnico con scoring 0–100, y 3) presentar mensajes prudentes (“riesgo técnico visible”, “posible desalineación con criterios de autoridad”) más un disclaimer claro de que no es asesoramiento legal.[^4][^5][^6]

> Nota: Todo lo siguiente es análisis técnico-regulatorio para diseño de producto. No es asesoramiento legal y debería ser revisado por abogado o DPO antes de usarse comercialmente.

***

## Mapa normativo UE / España / Países Bajos

Tabla de alto nivel (puedes ampliarla en tu doc interno):


| Norma / guía / autoridad | País / ámbito | Tema cubierto | Requisito relevante | Implicación para una web | Implicación para el scanner | Fuente exacta |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| GDPR Art. 4(11), 7, Recital 32 | UE | Consentimiento | Consentimiento debe ser libre, específico, informado, inequívoco; silencio, inacción o cajas premarcadas no valen; retirada tan fácil como darlo.[^4][^7] | No usar casillas premarcadas, ni “seguir navegando = consentir”; debe haber acción afirmativa y fácil retirada. | Detectar casillas premarcadas, patrones de “continuar navegando” como consentimiento, ausencia de mecanismos de retirada visibles.[^4][^7] | Art. 7 GDPR y Recital 32.[^4][^7] |
| Directiva ePrivacy Art. 5(3) | UE | Cookies / trackers | Requiere consentimiento previo e informado para almacenar/acceder a info en el terminal, salvo cookies estrictamente necesarias.[^3][^8] | No colocar cookies de analítica, publicidad, A/B testing, social, etc. antes de consentimiento. | Analizar cookies y storage antes de cualquier interacción con banner; clasificar técnicas exentas vs no exentas.[^1][^3] | Art. 5(3) ePrivacy (resumen técnico).[^3] |
| EDPB Guidelines 05/2020 | UE | Consentimiento (incl. cookies) | Reitera estándar de consentimiento del GDPR; cookie walls no dan consentimiento libre; “scrolling” o “seguir navegando” no son consentimiento válido.[^5] | Evitar cookie walls sin alternativa equivalente; no usar scroll como consentimiento; botones de rechazo tan accesibles como aceptación. | Checks sobre cookie walls, ausencia de opción equivalente, uso de scroll/actividad pasiva como señal de consentimiento.[^5] | EDPB, Guidelines 05/2020, secciones 3.1.2 (conditionality) y 3.4 (unambiguous indication).[^5] |
| EDPB Guidelines 03/2022 (deceptive design patterns) | UE | Dark patterns | Prohíbe interfaces que manipulan o dificultan ejercer derechos, incl. exagerar el botón “Aceptar”, esconder rechazo, flujos confusos.[^9][^1] | No usar jerarquía visual que favorezca “Aceptar”, ni rutas mucho más largas para rechazar; no textos engañosos. | Heurísticas de UI: contraste, tamaño, posición de botones, nº de clics para rechazar vs aceptar; marcar como “posible patrón engañoso”.[^9][^1] | EDPB Guidelines 03/2022, ejemplos de dark patterns.[^9][^1] |
| AEPD – Guía sobre el uso de cookies (mayo 2024) | España | Cookies, banners, analítica, publicidad | Exige transparencia por capas, consentimiento previo para cookies no exentas, botón “Rechazar” equivalente al de “Aceptar”, info sobre terceros, finalidades, plazos y transferencias.[^1][^6] | Debe haber banner con info básica + enlace a política, botones “Aceptar” y “Rechazar” al mismo nivel, opción “Configurar”, identificación de terceros y finalidades.[^1][^6] | Detectar presencia de banner, botones simétricos, enlace a configuración, menciones a finalidades, terceros, plazos y transferencias en políticas.[^1][^6] | Guía de cookies AEPD, secciones 3 (obligaciones) y actualizaciones 2023–2024.[^1][^6] |
| AEPD – Guía RGPD para responsables | España | Transparencia, base legal, derechos, transferencias | Refuerza consentimiento inequívoco y transparencia; derecho a información clara, incluida base legal, destinatarios y transferencias; enfoque de riesgo y responsabilidad proactiva.[^10] | Formularios y políticas deben informar de responsable, fines, base legal, destinatarios, plazos y transferencias; recoger consentimiento explícito cuando sea la base.[^10] | Checks sobre contenido mínimo de políticas y formularios (fines, base legal, derechos, contacto, transferencias); clasificación de riesgo en función de lagunas.[^10] | Guía RGPD AEPD, apartados sobre consentimiento y transparencia.[^10] |
| Autoriteit Persoonsgegevens (AP) – normativa cookies | NL | Tracking cookies, Tw 11.7a, consentimiento | Telecommunicatiewet requiere consentimiento previo para tracking cookies y muchas cookies analíticas; solo se exceptúan las estrictamente necesarias y ciertas analíticas “privacy friendly”.[^2][^2] | No colocar tracking cookies sin consentimiento; analítica sin consentimiento solo si es muy poco intrusiva (p.ej., IP anonimizada y sin compartir con terceros). | Clasificar cookies como tracking/analytics, marcar analítica sin anonimización como “requiere consentimiento”; detectar cookies antes de decisión.[^2][^11] | ICTRecht sobre AP + Telecommunicatiewet 11.7a; explicación AP.[^2][^12] |
| ACM – Cookies plaatsen | NL | Cookies, clasificación y consentimiento | Funcionales: sin consentimiento; analíticas con bajo impacto: sin consentimiento; tracking y algunas analíticas: solo con consentimiento, sin casillas premarcadas y sin engaño.[^11] | Necesario informar claramente y pedir consentimiento antes de tracking/analítica intrusiva; no esconder info en términos generales. | Checks de tipo de cookie, existencia de consentimiento previo, textos claros sobre qué se recoge y para qué, ausencia de casillas premarcadas.[^11] | ACM “Cookies plaatsen”, secciones Functionele/Analytische/Privacygevoelige cookies. |
| ACM – Cookies (acm.nl) | NL | Ejemplo de analítica exenta | Usa analítica (SiteImprove) sin consentimiento, anonimiza IP y no usa tracking; explica en política que cae bajo excepción de la cookiewet.[^11] | Modelo para analítica “baja intrusión”: IP truncada, sin compartir datos, fines puramente estadísticos. | Heurística para bajar severidad cuando se detectan patrones de analítica potencialmente exenta (IP anonimizada, 1ª parte, fines limitados).[^11][^2] | ACM cookies, explicación de excepción.[^11] |
| AP / privacidad-web – tracking cookies | NL | Reglas prácticas tracking cookies | Debe informarse antes sobre tipo de cookies, datos, finalidad, plazo de conservación; no es válido “seguir usando la web” ni casillas preseleccionadas como consentimiento.[^12][^2] | Necesario banner con info previa, botones aceptar/rechazar; no vale banner informativo sin opción clara de rechazo. | Checks de textos tipo “al seguir navegando acepta cookies”, casillas pre-marcadas, ausencia de botón “rechazar”.[^12][^2] | AP Q\&A “Wanneer mogen organisaties tracking cookies plaatsen…”.[^12] |
| EDPB cookie banner taskforce (integrado en Guía AEPD 2023) | UE/ES | Banners de cookies | Aceptar y rechazar deben mostrarse “al mismo nivel” (posición, tamaño, formato); rechazar no puede ser más difícil.[^4][^13] | Botones de aceptar/rechazar de tamaño y contraste similar en primera capa; sin rutas mucho más largas para rechazo. | Checks de prominencia relativa de botones y nº de clics para rechazar vs aceptar; marcar como posible dark pattern si hay asimetría fuerte.[^4][^13] | Informe cookie banner taskforce, recogido en Guía AEPD 2023.[^4][^13] |

Esto cubre los ejes clave que quieres: cookies no esenciales, consentimiento previo/granular, facilidad para rechazar, dark patterns, analítica, publicidad, terceros, formularios, políticas y transferencias.[^5][^3][^1]

***

## Matriz de checks técnicos

Voy a definir una matriz de checks priorizando los ejemplos que has pedido. Puedes tomar esto como “versión 1” de tu catálogo interno.

### 1. Cookies y trackers

| ID | Nombre del check | Qué detecta | Cómo detectarlo técnicamente | Evidencia a guardar | Severidad sugerida | Riesgo jurídico asociado | Texto recomendado al usuario | Limitaciones / posibles falsos positivos |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| C-001 | Cookies de analítica antes del consentimiento | Cookies de analítica colocadas en la carga inicial, sin interacción previa con banner. | Cargar la página en un contexto limpio (sin cookies previas), interceptar `Set-Cookie` y storage antes de cualquier clic; clasificar por nombre/patrón proveedor (p.ej. `_ga`, `_gid`, etc.).[^1][^3] | Lista de cookies con timestamp, dominio, bandera “antes/después del consentimiento”, captura de red y captura de pantalla del estado inicial. | High (Critical si además son de terceros como GA). | Violación de ePrivacy (consentimiento previo) y posible falta de base legal bajo GDPR Art. 6, además de ausencia de consentimiento válido.[^3][^5] | “Se han detectado cookies de analítica que se colocan antes de obtener consentimiento. Esto supone un riesgo técnico elevado respecto a los requisitos de consentimiento previo para cookies no esenciales.” | Distinguir analítica exenta puede requerir configuración específica (p.ej. anonimización IP). El scanner no puede verificar contratos ni configuraciones servidor-side; marcar como “potencialmente no exenta” y permitir override humano.[^11][^2] |
| C-002 | Cookies publicitarias antes del consentimiento | Cookies de publicidad / remarketing colocadas antes de consentimiento. | Igual que C-001, pero buscando patrones de adtech: `__fbp`, `IDE`, `fr`, ids de DoubleClick, etc., y dominios de ad networks conocidos.[^3] | Igual que C-001. | Critical | Riesgo alto de infracción de ePrivacy y tratamiento de datos personales para publicidad sin consentimiento (perfilado).[^3][^5] | “Se han detectado cookies de publicidad comportamental antes de cualquier acción de consentimiento. Esto indica un riesgo técnico crítico en materia de cookies y publicidad comportamental.” | La clasificación se basa en listas de dominios y nombres; proveedores nuevos pueden no estar catalogados; mantener listas actualizadas. |
| C-003 | Trackers de terceros antes del consentimiento | Carga de scripts/pixels de terceros (ads, social, analytics, heatmaps) antes del consentimiento. | Inspeccionar solicitudes de red y `<script>`/`<img>` externos cargados en la primera vista; cruzar con listas de proveedores (Google, Meta, LinkedIn, Hotjar, etc.).[^1][^14] | Log de peticiones de red (URL, dominio, tipo, momento relativo al banner), HTML relevante. | High–Critical según tipo. | Almacenar/acceder a info en terminal para fines no esenciales sin consentimiento previo; posible transferencia internacional sin base adecuada.[^3] | “Se han detectado scripts o píxeles de terceros cargados antes del consentimiento de cookies. Esto representa un riesgo técnico relevante y puede requerir revisión de la configuración del gestor de etiquetas y del banner.” | Server-side tagging puede ocultar parte del tracking; el scanner solo ve lo client-side. Indicar esta limitación. |
| C-004 | Google Tag Manager antes del consentimiento | GTM cargado y ejecutando tags no esenciales antes del consentimiento. | Detectar carga de `www.googletagmanager.com` o `gtm.js` + inspeccionar si a través de GTM se disparan requests a dominios de tracking antes del consentimiento (no siempre trivial). | Peticiones a GTM, listado de tags disparados (cuando sea observable), captura de red. | High | Si GTM dispara tags de analítica/ads antes del consentimiento, hay incumplimiento de ePrivacy y posible falta de consentimiento válido para varios tratamientos.[^3] | “Google Tag Manager se carga antes del consentimiento y parece disparar etiquetas de analítica o publicidad. Esto supone un riesgo técnico elevado; revise la configuración para que GTM respete las preferencias de consentimiento.” | No siempre es posible inferir qué tags se disparan desde GTM (especialmente con configuraciones complejas). Marcar claramente como “posible” riesgo. |
| C-005 | Meta Pixel antes del consentimiento | Presencia de Meta Pixel activo antes de consentimiento. | Buscar `connect.facebook.net` o `tr?id=` en requests o código inicial. | Request con query `tr?id`, headers, cookies asociadas, timestamp. | Critical | Tracking cross-site con probable tratamiento de datos personales y transferencia a EE. UU. sin consentimiento válido.[^5][^3] | “Se observa que Meta Pixel se carga antes del consentimiento de cookies, lo que supone un riesgo técnico crítico de tracking publicitario sin consentimiento previo.” | Algunos sitios cargan el script pero bloquean el disparo mediante Consent Mode/TCF; el scanner debe intentar observar si se envían realmente eventos antes del consentimiento. |
| C-006 | LinkedIn Insight Tag antes del consentimiento | Insight Tag ejecutándose antes de consentimiento. | Detectar requests a `px.ads.linkedin.com` o scripts de LinkedIn en la primera carga. | Logs de requests, cookies, HTML del script. | High–Critical | Igual que otros pixels advertising, basado en consentimiento.[^3] | “La etiqueta de LinkedIn se carga antes del consentimiento, indicando un riesgo técnico significativo en relación con las reglas de consentimiento previo para tracking cookies.” | Idem Meta Pixel. |
| C-007 | Hotjar / Clarity antes del consentimiento | Herramientas de sesión y heatmaps antes de consentimiento. | Detectar dominios de Hotjar, Clarity u otros session recorders en la primera carga. | Requests iniciales, cookies, scripts. | High | Estas herramientas registran comportamiento detallado; se consideran tracking y requieren consentimiento.[^14][^1] | “Se detectan herramientas de sesión (p.ej., Hotjar/Clarity) activas antes del consentimiento, lo que constituye un riesgo técnico elevado por registrar la navegación sin consentimiento previo.” | Algunas instalaciones podrían estar configuradas sin almacenamiento de IPs o con fuertes anonimización; el scanner no puede verificarlo todo. |
| C-008 | Posible fingerprinting | Técnicas de fingerprinting sin cookies evidentes. | Buscar librerías conocidas, accesos masivos a APIs de device/browser (canvas, audio, fonts) combinados de forma sospechosa. | Lista de APIs accedidas, scripts implicados, trazas JS (cuando se pueda). | High | ePrivacy cubre también cualquier acceso a info del terminal, no solo cookies; fingerprinting suele requerir consentimiento muy claro.[^1][^3] | “Se ha detectado un patrón de acceso al dispositivo que podría indicar técnicas de ‘fingerprinting’. Esto representa un riesgo técnico relevante y debería ser revisado por un especialista en privacidad.” | Difícil de detectar con certeza; marcar explícitamente baja confianza. |
| C-009 | Cookies con duración excesiva | Cookies no esenciales con vida muy larga. | Leer fecha de expiración; marcar cookies de marketing/analítica con expiración > 13–24 meses (umbral configurable). | Nombre, dominio, categoría inferida, expiración. | Medium | Las guías suelen esperar caducidades proporcionadas a la finalidad; duraciones muy largas pueden considerarse desproporcionadas. | “Se han identificado cookies no esenciales con una duración inusualmente larga. Aunque no existe un límite fijo en la normativa, esto puede aumentar el riesgo percibido y debería revisarse su necesidad.” | No hay umbral legal duro; este check debe presentarse como recomendación de buenas prácticas, no como incumplimiento. |
| C-010 | Falta de atributos Secure / SameSite | Cookies con datos potencialmente sensibles sin `Secure`/`SameSite` adecuados. | Inspeccionar atributos de cookies; marcar cookies enviadas sobre HTTPS sin `Secure`, o sin `SameSite` para contextos de terceros. | Nombre, atributos, contexto (HTTP/HTTPS, 1st/3rd party). | Medium | Más ligado a seguridad que a privacidad legal, pero relevante para “integridad y confidencialidad” bajo Art. 5(1)(f) GDPR.[^10] | “Algunas cookies se envían sin atributos de seguridad recomendados (`Secure` / `SameSite`). Esto supone un riesgo técnico de seguridad que podría impactar en la protección de datos personales.” | Algunos entornos legacy o cookies puramente técnicas; permitir al usuario ajustar sensibilidad de este check. |

### 2. Banner y consentimiento

| ID | Nombre del check | Qué detecta | Cómo detectarlo | Evidencia | Severidad | Riesgo jurídico | Texto recomendado | Limitaciones |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| B-001 | Ausencia de banner/CMP detectable | No se detecta ningún mecanismo visible de consentimiento pese a haber cookies no esenciales. | Buscar elementos típicos de CMP (divs superpuestos, iframes conocidos, textos “cookies”, “aceptar”, “rechazar”) y correlacionarlo con presencia de cookies no exentas. | Capturas de pantalla, HTML, listado de cookies. | High–Critical (si hay tracking/ads) | Colocar cookies no esenciales sin consentimiento previo ni información adecuada.[^1][^3] | “Se han detectado cookies no esenciales sin que aparezca ningún banner o gestor de consentimiento. Esto indica un riesgo técnico alto en materia de cookies y transparencia.” | Banners muy personalizados pueden no ser detectables por reglas genéricas; usar varias heurísticas y marcar confianza. |
| B-002 | Botón de aceptar sin botón de rechazar equivalente en 1ª capa | Asimetría clara: opción de aceptar visible, rechazo escondido o inexistente. | Analizar texto y botones del banner inicial; comprobar presencia de términos “aceptar” vs “rechazar” / “rechazar cookies” y su visibilidad (mismo nivel, tamaño). [^4][^6] | Captura del banner, HTML de botones. | High | EDPB y AEPD exigen que aceptar y rechazar estén al mismo nivel; si rechazar es más difícil, el consentimiento no es “libre”.[^5][^1] | “El banner de cookies ofrece un botón visible para ‘Aceptar’, pero no un mecanismo equivalente para ‘Rechazar’ en la primera capa. Esto puede suponer un patrón engañoso y un riesgo técnico elevado en cuanto a la validez del consentimiento.” | Algunos diseños usan texto-link discreto; el scanner puede no evaluar perfectamente el contraste/color; marcar esto como “evaluación heurística de diseño”. |
| B-003 | Rechazo oculto en segunda capa | Para rechazar hay que abrir varias capas/configuraciones, mientras aceptar es 1 clic. | Contar pasos/clics: 1 clic para “Aceptar todo” vs múltiples para rechazar; analizar estructura del DOM del CMP. | Secuencia de interacciones simuladas, capturas. | High | El rechazo no es “tan fácil” como la aceptación, violando Art. 7(3) GDPR y las guías de DPAs.[^5][^15] | “Se ha detectado que rechazar cookies requiere más pasos que aceptarlas. Este diseño puede no cumplir con el requisito de que la retirada o denegación del consentimiento sea tan sencilla como otorgarlo.” | Necesita un motor de interacción (headless browser) que simule clics; muchos CMP tienen flujos complejos. |
| B-004 | Consentimiento preseleccionado | Casillas o toggles activados por defecto para categorías no esenciales. | Buscar `<input type="checkbox" checked>` o toggles activos por defecto en la capa de configuración para categorías de analítica/marketing.[^4][^7] | HTML de switches y su estado inicial. | High | Recital 32: casillas premarcadas no constituyen consentimiento; muchos casos sancionados (Planet49, etc.).[^4][^7] | “Se han encontrado opciones de cookies no esenciales preseleccionadas. De acuerdo con el estándar europeo de consentimiento, esto supone un riesgo técnico elevado, ya que el consentimiento debe requerir una acción afirmativa del usuario.” | Algunas librerías renderizan dinámicamente; hay que capturar estado antes de cualquier interacción. |
| B-005 | “Seguir navegando” como consentimiento | Textos que indican que seguir usando/scrolling implica consentimiento. | Buscar patrones lingüísticos en el banner o la web (“al seguir navegando”, “si continúa usando este sitio…”). [^12][^5] | Texto del banner, captura. | High | EDPB y varias DPAs (incl. AP) consideran que scroll o seguir navegando no es consentimiento válido.[^5][^12] | “El sitio indica que ‘seguir navegando’ implica aceptar cookies. Este patrón se considera insuficiente para obtener un consentimiento válido y representa un riesgo técnico relevante.” | Algunos textos pueden referirse a otras cuestiones; usar listas de patrones específicas y marcar como “texto potencialmente problemático”. |
| B-006 | Cookie wall | Acceso bloqueado hasta aceptar cookies, sin alternativa real. | Detectar overlays que impiden interacción con el contenido si no se aceptan cookies; comprobar si existe alternativa (pago, versión sin tracking) visible. [^5][^10] | Capturas antes/después, HTML del overlay. | High–Critical | EDPB: cookie walls normalmente no dan consentimiento libre; AEPD lo matiza solo con alternativa equivalente, incluso de pago.[^5][^10] | “Se ha detectado un muro de cookies que bloquea el acceso al contenido si no se aceptan cookies. Según criterios europeos, esto suele impedir que el consentimiento sea libre y supone un riesgo técnico crítico.” | Caso complejo: algunos modelos “pay or OK” pueden ser válidos con condiciones; el scanner solo puede marcar un riesgo, no concluir ilegalidad. |
| B-007 | Falta de opción “configurar preferencias” | Solo “Aceptar todo” (y quizá “Rechazar”), sin granularidad. | Analizar botones disponibles: si no hay opción clara de “Configurar” o similar, marcar. [^1][^5] | HTML del banner. | Medium–High | Requieren granularidad por finalidad, especialmente cuando hay múltiples propósitos (analítica, ads, etc.).[^5][^1] | “El banner no ofrece una opción de ‘configurar preferencias’ por finalidad. Esto dificulta el consentimiento granular y puede ser contrario al principio de especificidad del consentimiento.” | Algunos sitios ofrecen granularidad en una segunda visita o área de cuenta; difícil de abarcar en un único escaneo. |

### 3. Política de privacidad / cookies

| ID | Nombre | Qué detecta | Cómo | Evidencia | Sev. | Riesgo | Texto recomendado | Limitaciones |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| P-001 | Sin enlace a política de privacidad | No se encuentra enlace evidente a la política. | Buscar enlaces con texto “privacidad”, “privacy”, “protección de datos”, etc. en header/footer y en formularios. | HTML, capturas. | High | Transparencia deficiente (Art. 12–13 GDPR); base de cualquier tratamiento.[^10] | “No se ha encontrado un enlace visible a la política de privacidad. Esto supone un riesgo técnico elevado en relación con las obligaciones de transparencia.” | Textos muy personalizados o en otro idioma pueden escaparse; permitir configuración de palabras clave. |
| P-002 | Sin política de cookies enlazada | No hay página específica o sección clara sobre cookies. | Buscar “cookies”, “cookie policy” en la página o en el footer. | HTML. | Medium–High | La LSSI/ePrivacy requieren info clara y completa sobre cookies y finalidades.[^1] | “No se ha detectado una política de cookies claramente enlazada. Esto dificulta cumplir el requisito de información clara sobre el uso de cookies.” | Algunas webs integran cookies en la política de privacidad general: el scanner debe intentar detectar menciones internas. |
| P-003 | Política sin mención de finalidades de cookies | Falta de explicación de para qué se usan las cookies. | Analizar texto de la política buscando mención de “finalidad”, “propósito”, o categorías (técnicas, analítica, publicidad, etc.).[^1] | Extracto de la política. | Medium | Transparencia incompleta (Art. 13 y Guía AEPD). | “La política analizada no describe claramente las finalidades para las que se utilizan las cookies, lo que supone un riesgo técnico medio de falta de transparencia.” | NLP puede fallar en textos muy escuetos o mal redactados. |
| P-004 | Política sin mención de terceros | No se listan terceros proveedores de cookies. | Buscar nombres de proveedores habituales o secciones tipo “terceros”, “third parties”.[^1][^14] | Extracto. | Medium–High | Falta de transparencia sobre destinatarios/terceros.[^1][^10] | “No se identifican de forma clara los terceros que colocan cookies en el sitio (analítica, publicidad, etc.), pese a haberse detectado scripts de terceros. Esto representa un riesgo técnico relevante en cuanto a transparencia.” | Si el sitio usa muy pocos terceros o solo propios, puede ser falso positivo; correlacionar con detección de scripts externos. |
| P-005 | Política sin base legal | No se indica base legal para tratamientos (especialmente analítica/marketing). | Buscar “consentimiento”, “interés legítimo”, “contrato” en secciones de cookies/datos. | Extracto. | Medium | Art. 13 exige indicar base legal; para cookies no técnicas suele ser consentimiento.[^10] | “La política no especifica la base legal utilizada para los tratamientos asociados a cookies y marketing, lo que supone un riesgo técnico medio de falta de transparencia.” | Muchas políticas indican base legal de forma genérica; el check debe ser conservador. |
| P-006 | Política sin información sobre conservación | Falta de plazos de conservación de datos/cookies. | Buscar expresiones de duración, plazos, ejemplos de expiración por cookie. | Extracto. | Medium | Requisito de indicar plazos o criterios de conservación (Art. 13(2)(a)).[^10] | “No se han encontrado referencias claras a los plazos de conservación de datos o cookies. Esto representa un riesgo técnico medio en relación con la transparencia.” | Algunas políticas indican criterios (no números); hay que aceptarlo como válido. |
| P-007 | Política sin derechos ni contacto | No se describen derechos de los usuarios ni contacto DPO/responsable. | Buscar sección de derechos (acceso, rectificación, oposición…) y contacto (correo, DPO). | Extracto. | High | Incumplimiento directo de art. 13–14 y guías AEPD.[^10] | “La política no detalla los derechos de protección de datos ni un punto de contacto (responsable / DPO), lo que supone un riesgo técnico elevado de falta de transparencia.” | Webs muy pequeñas pueden tener textos mínimos; el “riesgo técnico” debe ir acompañado de recomendación, no de juicio legal. |
| P-008 | Política sin mención de transferencias internacionales | No se informa de transferencias a terceros países, pese a usar proveedores fuera del EEE. | Cruzar scripts detectados (p.ej. Google, Meta) con texto de política para ver si menciona transferencias o EE. UU. | Extracto, lista de proveedores. | High | Transferencias internacionales requieren información y, en muchos casos, garantías adicionales.[^10][^3] | “Se han detectado servicios de terceros con posible transferencia internacional de datos, pero la política no menciona estas transferencias. Esto supone un riesgo técnico elevado que debería ser revisado por el DPO o asesor legal.” | El scanner no puede confirmar ubicación real del procesamiento; solo puede inferir por proveedor. Requiere revisión humana. |

### 4. Formularios

| ID | Nombre | Qué detecta | Cómo | Evidencia | Sev. | Riesgo | Texto recomendado | Limitaciones |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| F-001 | Formulario sin enlace visible a privacidad | Formularios que recogen email/teléfono/nombre sin enlace cercano a la política. | Detectar `<form>` y campos personales; buscar enlace a política dentro del mismo bloque o inmediatamente adyacente. | HTML del formulario, captura. | Medium–High | Falta de cumplimiento del deber de información en el punto de recogida.[^10] | “Este formulario recoge datos personales sin un enlace visible a la política de privacidad cerca del punto de recogida. Esto supone un riesgo técnico relevante respecto al deber de informar.” | Algunos sitios muestran info en popups o pasos siguientes; difícil capturarlo en un solo escaneo. |
| F-002 | Newsletter sin consentimiento separado | Checkboxes poco claros o falta de opt-in explícito para suscripciones. | Detectar checkboxes asociados a newsletter/marketing y ver si están claramente etiquetados y no premarcados. | HTML, estado de checkboxes. | Medium–High | Mezclar suscripción con otros consentimientos o ausencia de opt-in claro puede invalidar consentimiento para marketing.[^4][^5] | “La suscripción a comunicaciones comerciales parece no estar claramente separada del resto de finalidades, lo que puede afectar a la validez del consentimiento para marketing.” | Difícil distinguir newsletters transaccionales vs marketing puro; etiquetar como “posible riesgo”. |
| F-003 | Checkbox pre-marcado en formulario | Casillas de consentimiento ya activadas. | Igual que B-004 pero en contexto de formularios. | HTML. | High | Casillas premarcadas no son consentimiento válido.[^4][^7] | “Se han detectado casillas de consentimiento pre-marcadas en el formulario. Este patrón se considera incompatible con el requisito de consentimiento mediante acción afirmativa.” | Podría ser un checkbox no relacionado con datos (p.ej. aceptar términos obligatorios); conviene diferenciar por texto. |
| F-004 | Datos sensibles sin aviso visible | Campos que sugieren datos especiales sin información reforzada. | Buscar campos con términos como “salud”, “religión”, “DNI/pasaporte”, “número de seguridad social”, etc. y ausencia de texto explicativo. | HTML y etiquetas. | High | Datos especiales requieren condiciones más estrictas (consentimiento explícito u otras bases); se espera info reforzada.[^10] | “Este formulario pide datos especialmente sensibles sin información reforzada sobre su tratamiento. Esto supone un riesgo técnico alto que debería ser revisado por un especialista en protección de datos.” | El scanner no siempre puede inferir si el campo realmente captura dato especial; usar heurísticas conservadoras. |
| F-005 | Falta de información básica junto al formulario | No se indica quién es el responsable, finalidad o enlace a información ampliada. | Analizar contexto textual del formulario. | Extracto de texto cercano. | Medium | El RGPD exige que la información llegue al interesado “en el momento” de recogida, aunque sea por capas.[^10] | “No se ha encontrado información básica sobre el responsable y la finalidad del tratamiento junto al formulario, ni un enlace claro a información ampliada. Esto representa un riesgo técnico medio en cuanto al cumplimiento del deber de información.” | Algunas webs usan modales al enviar; el scanner quizá no los vea si no envía el formulario. |

### 5. Terceros y transferencias

| ID | Nombre | Qué detecta | Cómo | Evidencia | Sev. | Riesgo | Texto recomendado | Limitaciones |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| T-001 | Muchos terceros externos | Número elevado de dominios terceros cargados. | Contar dominios externos (fuera del dominio principal) en la carga inicial; agrupar por tipo (CDN, analytics, ads, widgets). | Lista de dominios por categoría. | Low–Medium (según tipo) | Cuantos más terceros, más compleja la cadena de tratamiento y más difícil asegurar transparencia y contratos. | “Se han detectado múltiples servicios de terceros (p.ej., analítica, publicidad, widgets). Esto incrementa la superficie de riesgo técnico y puede requerir una revisión de contratos y políticas de privacidad.” | Muchos terceros pueden ser puramente técnicos (CDN); la severidad debe ponderar el tipo. |
| T-002 | Scripts de proveedores no europeos | Dominios con probables transferencias fuera del EEE. | Resolver IP/WHOIS (con cautela) o usar listas de proveedores globales (Google, Meta, etc.). | Lista de dominios y país inferido. | Medium–High | Transferencias internacionales requieren salvaguardas y, a menudo, consentimiento específico.[^10][^3] | “Se han identificado servicios de terceros que probablemente implican transferencias de datos fuera del EEE. Esto supone un riesgo técnico relevante que debería ser revisado en clave de transferencias internacionales.” | Geolocalización IP y WHOIS no son determinantes; solo indicios. Marcar como “posible transferencia internacional”. |


***

## Diferencias España vs Países Bajos

### España — AEPD (cookies y banners)

Principales criterios prácticos (según Guía de Cookies actualizada 2023–2024 y notas de prensa):[^6][^1][^4]

- **Botones aceptar/rechazar**: obligación de incluir un botón o mecanismo equivalente para “Rechazar cookies” en la **primera capa**, al mismo nivel y con formato destacado similar al de “Aceptar”.[^13][^6]
- **Seguir navegando**: la AEPD, alineada con EDPB, ha ido abandonando el enfoque antiguo de “seguir navegando”; hoy no lo considera un consentimiento válido salvo casos muy excepcionales.[^10][^5]
- **Cookie walls**: solo podrían admitirse cuando se ofrezca una **alternativa de acceso al servicio sin necesidad de aceptar cookies**, que no tiene por qué ser gratuita, pero sí equivalente.[^1][^10]
- **Analítica**: la guía permite considerar determinadas cookies de preferencia y alguna analítica de primera parte como técnicas cuando el usuario las decide (p.ej. idioma), pero la analítica clásica (GA, etc.) requiere consentimiento.[^16][^1]
- **Configuración**: se recomienda/espera una opción de “Configurar” que permita granularidad por finalidad y, en su caso, por tercero.

Requisitos prácticos para ecommerce y formularios: políticas claras, info por capas, deber de información reforzado en puntos de recogida (formularios), y atención a transferencias en servicios de pago, logística, etc.[^10]

### Países Bajos — AP y ACM

- **Consentimiento para cookies**: Telecommunicatiewet 11.7a exige consentimiento previo para tracking cookies y muchas cookies analíticas, salvo cookies estrictamente necesarias y “analítica de bajo impacto”.[^2]
- **Analítica exenta**: la ACM muestra su propio ejemplo (SiteImprove + truncado de IP) como analítica que cae bajo la excepción, sin necesidad de banner ni consentimiento.[^11]
- **Tracking cookies**: AP ha enviado rondas de advertencias a sitios con tracking cookies sin consentimiento válido, enfatizando: no cookies antes de consentir, rechazo tan fácil como aceptar, granularidad por tipo de cookie y posibilidad de retirada fácil.[^17][^2]
- **Cookie walls**: la AP ha sido muy crítica con cookiewalls; trabajos doctrinales y comunicados señalan que bloquear acceso si no se aceptan tracking cookies no da consentimiento libre, salvo contadas excepciones (p.ej. algunos medios con alternativa real).[^18][^2]
- **Publicidad comportamental**: se enfatiza que tracking para remarketing y behavioral ads requiere consentimiento explícito; apoyo en AVG (GDPR) y Tw.[^19][^2]

En la práctica, el énfasis neerlandés está más en **cumplir estrictamente la Telecommunicatiewet y evitar tracking “por defecto”**, mientras que AEPD incorpora además criterios de dark patterns y diseño de interfaz muy detallados.[^19][^1]

### Tabla comparativa

| Tema | UE general | España | Países Bajos | Implicación para el scanner |
| :-- | :-- | :-- | :-- | :-- |
| Consentimiento previo para cookies | ePrivacy 5(3): consentimiento antes de almacenar/acceder, salvo estrictamente necesarias.[^3][^8] | Adopta ePrivacy vía LSSI; guía de cookies concreta excepciones y ejemplos. [^1] | Adopta ePrivacy vía Telecommunicatiewet 11.7a; foco fuerte en tracking cookies.[^2] | Check común: cookies/trackers antes del consentimiento = riesgo alto; en NL enfatizar tracking y analítica; en ES también publicidad y dark patterns. |
| Formato del banner | EDPB Guidelines 05/2020 + 03/2022: no cookie walls, no patrones engañosos, rechazo tan fácil como aceptar.[^5][^20] | Obliga botón “Rechazar” equivalente en primera capa; ejemplos sobre tamaño, color y posición.[^1][^6] | AP y ACM insisten en facilidad de rechazo; investigaciones sobre banners que dificultan rechazar.[^21][^15] | Checks de simetría de botones y nº de clics para rechazar; si la web se geodirige (ES/NL), puedes ajustar el copy de recomendaciones a la autoridad local. |
| “Seguir navegando” | EDPB rechaza scrolling/navegar como consentimiento.[^5] | La nueva guía abandona esta práctica de facto.[^10] | AP explícitamente indica que “seguir navegando” no da consentimiento válido.[^12][^2] | Check de textos tipo “al seguir navegando…” como riesgo alto en ambos países. |
| Analítica exenta | EDPB: posible solo si realmente minimizada y agregada, pero sin detallar.[^5][^22] | AEPD: abre la puerta a ciertas cookies de preferencias/analítica de baja intrusión decididas por el usuario.[^1][^16] | ACM/AP: analítica de bajo impacto sin consentimiento (ej. truncar IP, no compartir datos).[^11] | En ES/NL, el scanner puede bajar severidad a “Medium” cuando detecta patrones de analítica de baja intrusión; documentar criterios. |
| Cookie walls | EDPB: en general no dan consentimiento libre.[^5][^5] | AEPD admite solo si hay alternativa equivalente (puede ser de pago).[^10] | AP ha “hecho un fin” a la mayoría de cookiewalls sin alternativas reales.[^18][^2] | Check cookie wall = riesgo crítico; recomendar revisión legal especialmente para modelos “pay or OK”. |
| Dark patterns | Guidelines 03/2022 aplicables de forma horizontal.[^9][^1] | Guía de cookies 2023 integra criterios de patrones engañosos en banners.[^4][^1] | AP/ACM se enfocan en evitar banners que dificulten rechazo o utilicen engaño.[^2][^15] | Checks de prominencia visual, texto confuso, rutas de rechazo; marcar como “posible patrón engañoso” y sugerir revisión de UX. |
| Formularios y transparencia | Arts. 12–13 GDPR. | Guías AEPD: énfasis en info clara “en el punto de recogida”.[^10] | AP sigue el mismo estándar GDPR, sin guías tan detalladas para formularios web. | Checks de formularios sin enlace a privacidad, sin info básica; severidad algo mayor en ES por guías específicas. |


***

## Metodología de scoring

### Categorías de riesgo

- **Critical**: tracking/ads evidentes antes de consentimiento; cookie walls sin alternativa; patrones muy agresivos (solo “Aceptar”, rechazo imposible); ausencia total de política con abundante tracking.
- **High**: asimetrías importantes en banner (rechazo escondido), políticas sin info clave (terceros, transferencias), formularios sin info, muchos terceros de marketing sin transparencia.
- **Medium**: carencias parciales (p.ej. política que no menciona conservación, granularidad limitada), cookies de larga duración, ausencia de `Secure`/`SameSite` en cookies potencialmente sensibles.
- **Low**: temas de hardening y buenas prácticas (atributos de cookies, número de terceros técnicamente neutros).
- **Info**: señales neutrales/informativas (uso de CMP, presencia de opción de configuración, etc.).


### Peso por tipo de hallazgo (ejemplo defendible)

Define pesos base (ajustables):

- Critical: 20 puntos cada uno.
- High: 10 puntos.
- Medium: 5 puntos.
- Low: 2 puntos.

Luego:

1. **Score bruto = suma de pesos**, limitado a un máximo teórico (p.ej. 150).
2. **Score normalizado 0–100**: $score\_norm = \min(100,\; score\_bruto / 1.5 )$.
3. **Bandas sugeridas**:
    - 0–19: Bajo riesgo técnico detectable.
    - 20–49: Riesgo técnico moderado.
    - 50–79: Riesgo técnico alto.
    - 80–100: Riesgo técnico crítico (urgente).

### Reglas prácticas de severidad

- Cookies publicitarias/trackers antes del consentimiento → **Critical**.
- Pixel de grandes plataformas (Meta, LinkedIn, etc.) antes del consentimiento → **Critical**.
- No hay banner detectable y sí hay tracking → **Critical**.
- No hay política de cookies visible pero sí cookies no esenciales → **High**.
- Hay política pero no menciona terceros detectados → **Medium–High**.
- Formulario con datos personales sin enlace a privacidad visible → **Medium–High**.
- 10+ terceros externos de tipo marketing/analytics → **Medium** (se puede escalar a High si hay muchos de adtech).


### Falsos positivos y confianza

Cada check debería tener:

- **flag de confianza** (Alta, Media, Baja) según la robustez de la detección (regex simple vs detección basada en múltiples señales).
- **campo “requiere revisión humana”** para checks con baja confianza o fuerte componente de interpretación (p.ej. dark patterns, cookie walls complejos).

En el frontend, puedes mostrar algo tipo: “Confianza de la detección: 70%” para moderar expectativas.

### Separar “riesgo técnico” vs “conclusión legal”

Muy importante a nivel de copy:

- El scanner **solo** emite un “riesgo técnico visible” basado en evidencias observables (cookies, scripts, textos, estructura del banner).
- Siempre hay un paso de **interpretación jurídica** (p.ej. si una cookie concreta entra o no en la excepción de analítica, si una alternativa de pago hace válida una cookie wall) que debe corresponder a abogado/DPO.

En la UI/informe:

- Mostrar etiquetas como “Riesgo técnico visible” y “Probable desalineación con criterios de [AEPD/AP/EDPB]” en vez de “incumplimiento” o “infracción”.
- Añadir icono o nota en cada hallazgo que indique “Revisión legal recomendada” en determinados casos (p.ej. transferencias internacionales, modelos de cookie wall complejos).

***

## Evidencia técnica que debe guardar el scanner

### Lista y clasificación

**Necesaria (mínimo para que el informe tenga valor):**

- URL exacta escaneada.[^3]
- Fecha/hora del escaneo.
- País/IP o región utilizada para el test (especialmente si ofreces distintos perfiles geográficos).[^3]
- User-Agent utilizado.
- Estado de cookies **antes** de cualquier interacción (listado completo).
- Requests de red en la carga inicial (al menos dominios y tipos de recurso).[^2]
- HTML del banner de cookies (si se detecta).
- Capturas de pantalla del estado inicial de la página/banners.[^1]

**Recomendable (sube mucho el valor para auditoría):**

- Cookies **después de aceptar** y **después de rechazar**, si se simulan ambas rutas.
- Lista de dominios terceros clasificados por tipo (CDN, analytics, ads, social, mapas, chat, etc.).[^2][^3]
- Texto íntegro del banner (todos los mensajes y labels de botones).[^1]
- HTML o texto relevante de políticas de privacidad y cookies encontradas.
- Estructura de formularios (campos, textos de consentimiento, links cercanos).[^10]
- Eventos de consentimiento detectados (p.ej. TCF string en cookie, llamadas a endpoints de CMP).

**Avanzada (útil para consultores/GDPR nerds):**

- Grabaciones o snapshots de DOM antes/después de acciones simuladas (clic en aceptar/rechazar/configurar).
- Capturas de las distintas capas del CMP (1ª capa, 2ª capa de configuración).
- Logs más detallados de llamadas JS y uso de APIs que puedan indicar fingerprinting.
- Metadatos geográficos de cada request (país detectado del host).
- Export JSON/har completo por URL escaneada para que un consultor pueda rehacer el análisis.

En el informe deberías indicar claramente las **limitaciones del escaneo** (un punto obligatorio):

- “El escaneo refleja solo el comportamiento observado en el momento, desde la ubicación X, con navegador Y. Cambios de configuración, A/B tests o personalización geográfica pueden producir resultados distintos.”

***

## Lenguaje seguro y disclaimers

### Tabla de frases inseguras vs recomendadas

| Frase insegura | Riesgo de usarla | Versión recomendada | Cuándo usarla |
| :-- | :-- | :-- | :-- |
| “Esta web incumple el RGPD.” | Atribuye un juicio jurídico definitivo; te convierte en auditor/juez; riesgo de responsabilidad y conflicto con DPAs/abogados. | “Se ha detectado un riesgo técnico relevante que podría indicar una posible desalineación con los criterios habituales de cumplimiento del RGPD/ePrivacy. Recomendamos revisión legal.” | En hallazgos de severidad High/Critical. |
| “Sus banners son ilegales.” | Lenguaje categórico; ignora matices (p.ej. excepciones, contextos sectoriales). | “El diseño actual del banner presenta patrones que las autoridades europeas han considerado problemáticos en otros casos (p.ej., mayor dificultad para rechazar que para aceptar).” | Checks de dark patterns/asimetría. |
| “Las cookies de esta web son ilícitas.” | Afirma una ilicitud que dependerá de finalidad exacta, base legal, contrato con terceros. | “Se han detectado cookies no esenciales que parecen activarse antes de obtener un consentimiento explícito, lo que supone un riesgo técnico alto respecto a las normas sobre cookies.” | C-001/C-002/C-003. |
| “No cumple con la AEPD.” | Sugiere evaluación oficial; puede ser incorrecto si hay factores no observados. | “El patrón observado se aleja de las recomendaciones publicadas por la AEPD para banners de cookies (p.ej., ausencia de botón ‘Rechazar’ equivalente en primera capa).” | Sitios orientados a España. |
| “Esta configuración es ilegal en los Países Bajos.” | Mismo problema, con añadido de derecho nacional; riesgo de error. | “La Autoriteit Persoonsgegevens y la ACM han publicado criterios más estrictos para tracking cookies. La configuración detectada podría no alinearse con esas expectativas y debería revisarse.” | Sitios .nl o con localización NL. |
| “Garantizamos el cumplimiento de RGPD/ePrivacy.” | Promesa imposible para una herramienta automatizada; riesgo contractual y de publicidad engañosa. | “Ayudamos a identificar riesgos técnicos visibles relacionados con cookies, trackers y formularios. El análisis no sustituye una revisión legal completa.” | Landing, marketing, ventas. |

### Niveles de lenguaje

- **Seguro (recomendado por defecto)**
    - “Se detecta un riesgo técnico visible…”
    - “Este patrón podría ser problemático según las guías de…”
    - “Recomendamos revisar este punto con su DPO o asesor legal.”
- **Moderado (para usuarios avanzados/consultores)**
    - “Este patrón puede indicar un posible incumplimiento de los requisitos de consentimiento libre e informado.”
    - “La práctica observada ha sido objeto de advertencias o sanciones por varias autoridades en casos similares.”
- **A evitar**
    - “Infringe”, “es ilegal”, “no cumple”, “condenable jurídicamente”, salvo que un humano lo añada conscientemente en un contexto muy claro.


### Disclaimers recomendados

**Landing:**

> “Privacy Risk Scanner identifica riesgos técnicos visibles relacionados con cookies, trackers, banners y formularios web. No es una auditoría legal ni garantiza el cumplimiento del RGPD, la Directiva ePrivacy o la normativa nacional aplicable. Las decisiones de cumplimiento deben tomarse con el apoyo de un abogado o DPO.”

**Pantalla de resultados:**

> “Los hallazgos se basan exclusivamente en el comportamiento observado durante el escaneo (navegador, zona geográfica y configuración indicadas). No constituyen asesoramiento legal. Para valorar el cumplimiento normativo completo, se recomienda una revisión jurídica adicional.”

**Informe PDF:**

> “Este informe tiene carácter informativo y técnico. No constituye asesoramiento legal ni certifica el cumplimiento de ninguna norma. Las conclusiones se basan en evidencias automatizadas en el momento del escaneo y pueden no reflejar cambios posteriores. Se recomienda revisar estos resultados con el Delegado de Protección de Datos (DPO) o un asesor jurídico especializado.”

**Email comercial:**

> “Nuestra herramienta no sustituye una auditoría legal, pero permite a agencias, ecommerce y consultores detectar y priorizar riesgos técnicos visibles en sus webs para que puedan corregirlos y, en su caso, evaluar el cumplimiento normativo con su equipo legal.”

**Respuesta de API:**

Incluye campos como:

```json
"legal_disclaimer": "Este resultado describe riesgos técnicos visibles detectados de forma automatizada. No constituye asesoramiento legal ni certifica cumplimiento.",
"risk_type": "technical_risk",
"requires_legal_review": true
```


***

## Casos límite y falsos positivos

Ejemplos clave y cómo manejarlos:


| Caso límite | Riesgo de falso positivo | Cómo detectarlo mejor | Cómo comunicar la incertidumbre |
| :-- | :-- | :-- | :-- |
| Banner solo para ciertas regiones | Alto si escaneas desde una región “exenta” (p.ej. sólo muestran banner a IP UE). | Permitir elegir región/IP para el escaneo; documentar región usada; ofrecer re-scan con otra región. | “No se detectó banner en la región X. El sitio podría mostrar un banner distinto en otras localizaciones geográficas.” |
| Consentimiento previo guardado | Muy alto; si el usuario ya consintió, no verás el banner ni cookies “antes”. | Forzar contexto limpio: sin cookies ni local storage; user-agent y IP nuevos; borrar storage entre escaneos. | “El escaneo se ha realizado en un contexto limpio sin consentimientos previos. Si el comportamiento real difiere para usuarios recurrentes, este informe podría no reflejarlo.” |
| CMP cargado tarde | El scanner puede ver cookies antes porque el CMP se tarda en cargar. | Medir tiempos relativos: si cookies se disparan mucho antes del script del CMP, es un hallazgo válido; si están casi simultáneos, marcar como “posible retraso de carga”. | “Se observan cookies antes de que la interfaz de consentimiento sea visible. Esto puede deberse a un retardo de carga del CMP; recomendamos revisarlo.” |
| Botones solo con iconos (sin texto) | Detección de “Aceptar/Rechazar” puede fallar o ser ambigua. | Analizar `aria-label`, `title`, texto alternativo; usar heurísticas de color/posición. | “El análisis del banner se ha realizado mediante heurísticas de iconos y atributos accesibles. La clasificación de botones puede ser imprecisa en este caso.” |
| Shadow DOM / iframes | El banner puede estar encapsulado y no ser accesible por el crawler. | Dar soporte a Shadow DOM e iframes; si no es posible, marcar como limitación. | “Partes de la interfaz (incluido un posible banner) usan técnicas que impiden su análisis automático completo (Shadow DOM/iframes). Los resultados pueden estar incompletos.” |
| Scripts bloqueados por CSP o adblocker | Podrías no ver tracking que sí ven usuarios reales. | Escanear con un navegador sin adblockers y con CSP respetado; opcionalmente informar cuando CSP bloquea recursos. | “Algunos recursos fueron bloqueados por políticas de seguridad del navegador. Esto puede reducir la visibilidad de ciertos trackers durante el escaneo.” |
| Google Consent Mode / server-side tagging | No se ven cookies, pero sí mediciones/agregaciones del lado del servidor. | Intentar detectar `gtag`/Consent Mode y documentar que parte del tracking puede ser server-side; imposible verlo todo desde cliente. | “Se detecta el uso de modos de consentimiento o etiquetado del lado del servidor. El scanner solo puede analizar el comportamiento client-side; ciertas operaciones pueden no ser visibles.” |
| Analítica supuestamente “exenta” | No siempre puedes saber si IP está anonimizada o si hay acuerdos específicos. | Usar patrones conocidos (p.ej. parámetros GA anonymizeIP); en duda, marcar como analítica estándar y sugerir revisión. | “No es posible verificar si la configuración de analítica cumple todos los requisitos para considerar las cookies exentas de consentimiento. El riesgo se ha evaluado de forma conservadora.” |
| Traducciones o textos poco comunes | Las regex de idioma pueden fallar. | Soportar múltiples idiomas, permitir ampliar diccionario de patrones; usar ML sobre tiempo. | “El análisis de textos se realiza con patrones multilingües, pero expresiones poco comunes pueden no ser correctamente clasificadas.” |
| A/B testing de banners | Diferentes usuarios ven banners distintos. | Permitir múltiples escaneos por URL con seeds diferentes; resaltar variabilidad si se detecta. | “El sitio parece usar tests A/B en el banner de cookies. El comportamiento observado puede no ser igual para todos los usuarios.” |

En la UI, puedes marcar algunos hallazgos con un icono de “baja confianza” y un tooltip explicando el tipo de caso límite detectado.

***

## Roadmap MVP / V1 / V2

### MVP – “Demostrar valor sin sobredesarrollar”

Objetivo: detectar los riesgos más obvios y críticos con coste técnico razonable.

- **Checks imprescindibles:**
    - C-001, C-002, C-003 (cookies/trackers antes de consentimiento).
    - B-001, B-002, B-004, B-005 (banner inexistente, asimetría básica, casillas premarcadas, seguir navegando).
    - P-001, P-002 (falta de políticas enlazadas).
    - F-001 (formularios sin enlace a privacidad).
    - T-001 básico (conteo de terceros).
- **Estimación (muy macro):**

| Check / módulo | Coste técnico | Valor comercial | Riesgo de falso positivo |
| :-- | :-- | :-- | :-- |
| Detección de cookies/trackers antes de consentimiento | Medio | Alto | Bajo–medio |
| Detección básica de banners y botones (sin análisis visual sofisticado) | Medio | Alto | Medio |
| Detección de enlaces a políticas | Bajo | Medio–alto | Bajo |
| Formularios sin enlace a privacidad | Medio | Medio | Medio |
| Conteo básico de terceros | Bajo | Medio | Bajo–medio |

Entrega: CLI/API + informe sencillo (JSON/HTML) con scoring básico y mensajes “seguros”.

### V1 – “Producto listo para agencias/ecommerce”

Objetivo: vender informes white-label y dashboards a agencias, SaaS y ecommerce.

- Ampliar checks de MVP +:
    - Mayor granularidad en clasificación de cookies (analítica vs ads vs social vs heatmaps).
    - Análisis por capas del CMP (B-003, B-007), incluyendo número de clics para rechazar.
    - Checks avanzados de políticas (P-003–P-008).
    - Soporte multi-región (ES/NL/DE/FR) con ajustes de recomendaciones.
    - Evidencia más completa (HAR export, más capturas).
- Estimación:

| Módulo | Coste técnico | Valor comercial | Riesgo FP |
| :-- | :-- | :-- | :-- |
| Clasificación avanzada de cookies/terceros | Medio–alto | Alto | Medio |
| Simulaciones de clic en CMP (aceptar/rechazar/configurar) | Alto | Alto | Medio–alto |
| Parser de políticas con NLP ligero | Medio | Alto | Medio |
| Soporte multi-región / perfiles regulatorios | Medio | Alto | Bajo (a nivel técnico) |

### V2 – “Herramienta para consultores GDPR y medianas/grandes”

Objetivo: que consultores/DPOs puedan usarlo como input serio para auditorías.

- Funcionalidades avanzadas:
    - Detección heurística de fingerprinting (C-008) y Consent Mode/server-side tagging.
    - Modelos de scoring configurables por cliente (pesos, umbrales).
    - Comparativas históricas (evolución de riesgo por dominio).
    - Integración con sistemas de ticketing (crear tareas de corrección).
    - Export detallado para revisión legal (informes con anexos de evidencia).
- Estimación:

| Módulo | Coste técnico | Valor comercial | Riesgo FP |
| :-- | :-- | :-- | :-- |
| Fingerprinting / APIs avanzadas | Alto | Medio–alto (nicho) | Alto |
| Scoring configurable + plantillas por país | Medio | Alto | Bajo |
| Time series / historical diff | Medio | Medio | Bajo |
| Integraciones (Jira, Asana, etc.) | Medio | Medio | Bajo |


***

## Top 10 checks prioritarios para implementar ya

Si mañana tuvieses que lanzar algo funcional, mis “top 10” serían:

1. **C-002 – Cookies publicitarias antes del consentimiento** (critical).
2. **C-003 – Trackers de terceros (pixels/ads) antes del consentimiento**.
3. **C-001 – Cookies de analítica antes del consentimiento** (con heurística para “analítica exenta”).
4. **B-001 – Ausencia de banner/CMP detectable con cookies no esenciales**.
5. **B-002 – Botón “Aceptar” sin botón “Rechazar” equivalente en primera capa**.
6. **B-004 – Consentimiento preseleccionado (casillas premarcadas)**.
7. **B-005 – “Seguir navegando” como consentimiento**.
8. **P-001 – Falta de enlace visible a política de privacidad**.
9. **P-002 – Falta de política de cookies claramente enlazada**.
10. **F-001 – Formularios con datos personales sin enlace visible a la política de privacidad**.

Con solo estos 10, ya cubres una parte significativa de los patrones que las autoridades europeas están investigando y sancionando, y puedes aportar muchísimo valor a agencias, ecommerce y consultores sin entrar aún en zonas ultra-grises.[^19][^2][^1]

***

Si quieres, en un siguiente paso puedo ayudarte a convertir esta matriz en un esquema JSON concreto para tu motor de escaneo (incluyendo campos de evidencia, severidad, confianza y mensajes localizados ES/NL/EN).
<span style="display:none">[^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^40][^41][^42][^43][^44][^45][^46][^47][^48][^49][^50][^51][^52][^53][^54][^55][^56][^57][^58]</span>

<div align="center">⁂</div>

[^1]: https://www.cookieyes.com/blog/dark-patterns-in-cookie-consent/

[^2]: https://www.ictrecht.nl/blog/tracking-cookies-zonder-geldige-toestemming-autoriteit-persoonsgegevens-stuurt-waarschuwingsbrieven

[^3]: https://caritasdcr.es/wp-content/uploads/2023/09/AEPD-ACTUALIZACION-GUIA-DE-COOKIES-2023.pdf

[^4]: https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa/aepd-actualiza-guia-cookies-para-adaptarla-a-nuevas-directrices-cepd

[^5]: https://passiro.com/cookie-compliance/cookie-banners/dark-patterns/

[^6]: https://www.cuatrecasas.com/es/spain/propiedad-intelectual/art/entra-vigor-nuevo-criterio-aepd-uso-de-cookies

[^7]: https://lawandmore.nl/nieuws/tracking-cookies-analytics-en-remarketing-juridisch-veilig-online-adverteren-in-nederland/

[^8]: https://passiro.com/nl/resources/cookie-compliance/regulations/eprivacy/

[^9]: https://www.activemind.legal/guides/dark-patterns/

[^10]: https://www.ismsforum.es/noticias/2347/la-aepd-actualiza-su-gu-a-sobre-el-uso-de-cookies/

[^11]: https://www.edpb.europa.eu/system/files/2022-03/edpb_03-2022_guidelines_on_dark_patterns_in_social_media_platform_interfaces_en.pdf

[^12]: https://privacy-web.nl/vragen/wanneer-mogen-organisaties-tracking-cookies-plaatsen-op-mijn-computer/

[^13]: https://www.idissc.org/wp-content/uploads/2023/12/230915-nota-informativa-Guia-AEPD-cookies.pdf

[^14]: https://www.uria.com/documentos/circulares/1138/documento/8891/2019111-cookies-ESP.pdf?id=8891

[^15]: https://www.avg-support.nl/nieuws/strenger-toezicht-op-cookies-en-telemarketing/

[^16]: https://privacydriver.com/es/cambios-nueva-guia-cookies-2023-aepd-con-respecto-version-2020-c584

[^17]: https://vianederland.nl/kennisbank/autoriteit-persoonsgegevens-gaat-strenger-toezicht-houden

[^18]: https://www.considerati.com/nl/kennisbank/de-autoriteit-persoonsgegevens-maakt-een-einde-aan-cookiewalls.html

[^19]: https://jorijn.com/nl/blog/cookie-consent-banner-correct-gebruiksvriendelijk-en-avg-proof/

[^20]: https://www.edpb.europa.eu/system/files/2023-02/edpb_03-2022_guidelines_on_deceptive_design_patterns_in_social_media_platform_interfaces_v2_en_0.pdf

[^21]: https://www.security.nl/posting/795226/Consumentenbond:+weigeren+cookies+op+populaire+websites+vaak+te+lastig

[^22]: https://www.the-algo.com/knowledge/eprivacy-directive

[^23]: https://www.acm.nl/nl/verkoop-aan-consumenten/reclame-en-verleiden/online-beinvloeden/cookies-plaatsen

[^24]: https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf

[^25]: https://www.acm.nl/nl/cookies

[^26]: https://dev.to/tiamatenity/the-cookie-consent-scam-how-dark-patterns-weaponize-gdpr-and-turn-privacy-rights-into-surveillance-55n2

[^27]: https://www.digitaleoverheid.nl/overzicht-van-alle-onderwerpen/cookies-en-online-tracking/

[^28]: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/what-is-valid-consent/

[^29]: https://matomo.org/faq/general/eprivacy-directive-national-implementations-and-website-analytics/

[^30]: https://gdpr-info.eu/issues/consent/

[^31]: https://iapp.org/news/a/cjeu-clarifies-cookie-consent-requirements

[^32]: https://www.ppc.go.jp/files/pdf/doui_guideline_v1.1.pdf

[^33]: https://negg.blog/en/unambiguous-consent-under-gdpr-what-it-really-means/

[^34]: https://privacy-web.nl/en/publicaties/edpb-publiceert-richtsnoeren-05-2020-inzake-toestemming-overeenkomstig-verordening-2016-679/

[^35]: https://www.ivir.nl/publicaties/download/Computerrecht_2017_4.pdf

[^36]: https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_nl.pdf

[^37]: https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/legal-grounds-processing-data/grounds-processing/when-consent-valid_en

[^38]: https://kukie.io/blog/what-is-the-eprivacy-directive

[^39]: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en

[^40]: https://www.themomentum.ai/blog/gdpr-consent-requirements-health-data

[^41]: https://gdpr-text.com/read/article-7/

[^42]: https://cbf.nl/nieuws/avg-naleving-tracking-cookies

[^43]: https://gdpr.verasafe.com/recital-32/

[^44]: https://www.rocajunyent.com/sites/default/files/content/file/2023/08/04/1/es_guiacookies_informa_rocajunyent_202307_2.pdf

[^45]: https://usercentrics.com/knowledge-hub/the-eu-general-data-protection-regulation/

[^46]: https://ai-comply.eu/ar/regulations/gdpr/recital-32

[^47]: https://www.aepd.es/guias/guia-rgpd-para-responsables-de-tratamiento.pdf

[^48]: https://www.aepd.es/guias/guia-modelo-clausula-informativa.pdf

[^49]: https://rwv.nl/kennis/cookies-op-uw-website-mag-dat-wel-volgens-de-cookiewetgeving-en-avg

[^50]: https://securiti.ai/blog/edpb-guidelines-on-dark-patterns-in-social-media/

[^51]: https://www.aepd.es/documento/1-manuel-villaseca.pdf

[^52]: https://www.aepd.es/guias/gestion-riesgo-y-evaluacion-impacto-en-tratamientos-datos-personales.pdf

[^53]: https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento

[^54]: https://digitalpolicyalert.org/change/2069-edpb-guidelines-on-dark-patterns-in-social-media-platform-interfaces

[^55]: https://www.aepd.es/guias/guia-directrices-contratos.pdf

[^56]: https://www.marketingfacts.nl/berichten/acm-waarschuwt-websites-maar-hoe-krijg-je-goede-cookie-consent/

[^57]: https://www.aepd.es/guias/guia-cookies.pdf

[^58]: https://legal.areagris.nl/tracking-cookies/

