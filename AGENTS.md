# AGENTS.md

Userscript de navegador: detecta eventos (JSON-LD) en cualquier página y añade un botón para enviarlos a Google Calendar. Vite + TypeScript (sin React), empaquetado con `vite-plugin-monkey` a un solo archivo `dist/add-to-google-calendar.user.js`.

Repo público: `Gustavogalvez/add-to-google-calendar` (rama `main`). La UI va en español y la ficha (`@name`/`@description`) en inglés.

## Comandos

- `yarn dev` — Vite dev con HMR (sirve el userscript dev para instalar en Tampermonkey/Violentmonkey).
- `yarn build` — `tsc && vite build`. Puerta de corrección primaria (no hay test runner).
- `yarn preview` — previsualiza el build.
- Node no está en el `PATH` por defecto: `export PATH="$HOME/.local/node/bin:$PATH"` antes de `yarn`.

## Reglas de seguridad (obligatorias)

Este userscript corre en **todas** las páginas (`@match *://*/*`) con `grant: []`. Todo el código es visible para cualquier sitio en el que se ejecute. Por eso:

1. **Nunca incrustar secretos** en el fuente ni en `dist/`: sin claves de API, tokens, client secrets de OAuth ni credenciales. El código cliente es público y extraíble. `.env` y cualquier archivo con secretos van en `.gitignore`.
2. **No usar APIs autenticadas desde el userscript.** La integración con Google es por URL pública (`calendar.google.com/calendar/render?action=TEMPLATE`), sin OAuth. Si se necesitara la Google Calendar API, iría en un backend aparte, nunca en el userscript.
3. **Sin exfiltración.** No añadir `GM_xmlhttpRequest`, `@connect`, telemetría ni llamadas de red a terceros. El script no debe enviar datos de la página a ningún servidor.
4. **Los datos de la página son no confiables.** El JSON-LD se trata como input hostil: nunca `eval`, `new Function` ni inserción vía `innerHTML` con datos de la página. Para renderizar se usa `textContent` y Shadow DOM; `innerHTML` solo para marcado estático propio.
5. **Solo abrir enlaces http/https** (ya se valida en `resolveUrl`) y usar `window.open(url, "_blank", "noopener,noreferrer")` para evitar tabnabbing.
6. **No añadir `@grant`/permisos que no hagan falta.** Cada grant amplía la superficie de ataque.
7. **Nada de código dinámico** (`eval`, `Function`, `import()` de strings provenientes de la página, etc.).
8. **Acotar todo input no confiable.** Mantener los límites de tamaño: JSON-LD crudo antes de parsear (`MAX_RAW_LENGTH`), textos (`MAX_TEXT`), título/descripción/lugar y longitud del detalle de la URL. Leer siempre con `Object.hasOwn`, no con `in`.

## Publicación (repo público, `dist` en `main`)

- `dist/add-to-google-calendar.user.js` **sí se commitea** (es lo que sirven `updateURL`/`downloadURL`). `node_modules`, `.env`, `*.local` no.
- Antes de cada release, bumpear `version` en `vite.config.ts` (Tampermonkey compara el header).
- `updateURL`/`downloadURL` apuntan a `https://raw.githubusercontent.com/Gustavogalvez/add-to-google-calendar/main/dist/add-to-google-calendar.user.js`.
- Licencia MIT (`LICENSE`).
- CI: `.github/workflows/build-check.yml` compila y falla si `dist` no coincide con `src`. Dependabot semanal (`.github/dependabot.yml`).
- Seguridad de la cuenta: activar 2FA y branch protection en `main` (el `@updateURL` se autoinstala en todos los usuarios).
- Revisar `git status`/`git diff` antes de commitear; nunca añadir secretos.

## Arquitectura

- `src/main.ts` — arranque: detección inicial + `MutationObserver` (SPA) con debounce de 400 ms y firma para evitar re-render.
- `src/jsonld.ts` — extracción JSON-LD (`@graph`, `itemListElement`, `item`, `mainEntity`, `subEvent`, `events`) e `isEventNode`.
- `src/event.ts` — normalización a `CalendarEvent` (fechas, duración, lugar, descripción, url) con límites de tamaño.
- `src/detect.ts` — dedupe, orden cronológico, filtro de pasados, máx. 20.
- `src/calendar.ts` — genera la URL de Google Calendar (formato `YYYYMMDDTHHMMSS`, eventos de todo el día, `ctz`).
- `src/ui.ts` — botón flotante + panel en Shadow DOM (`EventWidget`).
- `src/types.ts`, `src/text.ts` — tipos y helpers.

## Convenciones

- TypeScript estricto con `noUnusedLocals`/`noUnusedParameters` (un import sin usar rompe `yarn build`).
- Sin React/MUI a propósito: UI vanilla con Shadow DOM. No introducir frameworks sin motivo.
- Sin comentarios en el código salvo que se pidan.
- Idioma: UI y docs en español; la ficha del userscript (`@name`/`@description`) en inglés para alcance público.
