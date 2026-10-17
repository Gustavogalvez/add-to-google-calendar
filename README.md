# Add to Google Calendar

Userscript que detecta eventos (JSON-LD) en páginas de entradas, conciertos y eventos, y añade un botón para enviarlos a Google Calendar en un clic.

## Qué hace

- Escanea el JSON-LD `schema.org/Event` de la página.
- Muestra un botón flotante; si hay varios eventos, un panel para elegir.
- Abre Google Calendar con el evento ya rellenado (título, fecha/hora, lugar, descripción y enlace). Solo pulsas **Guardar**.
- Funciona también en páginas SPA (vuelve a escanear al cambiar el DOM).

No usa OAuth ni envía datos a ningún servidor: únicamente construye una URL pública de Google Calendar.

## Instalación

1. Instala [Tampermonkey](https://www.tampermonkey.net/) o [Violentmonkey](https://violentmonkey.github.io/).
2. Abre el userscript: [add-to-google-calendar.user.js](https://raw.githubusercontent.com/Gustavogalvez/add-to-google-calendar/main/dist/add-to-google-calendar.user.js) — el gestor ofrecerá instalarlo.
3. Las actualizaciones llegan solas vía `@updateURL`.

## Uso

Entra en la página del evento y pulsa el botón **Añadir al calendario** en la esquina inferior derecha.

## Cómo funciona

- `src/jsonld.ts` — extrae los nodos `Event` (incluye `@graph`, `itemListElement`, `item`, `mainEntity` y `subEvent`).
- `src/event.ts` — normaliza fechas (todo el día o con hora), duración, lugar, descripción y URL.
- `src/calendar.ts` — genera la URL `calendar.google.com/calendar/render?action=TEMPLATE&…`.
- `src/ui.ts` — pinta el botón/panel en un Shadow DOM aislado.
- `src/main.ts` — arranque y re-detección en navegación SPA.

## Limitaciones

- Depende de que la web incluya JSON-LD `Event` (Ticketmaster, Eventbrite y muchas otras sí).
- La hora se interpreta en tu zona horaria local.
- Por ahora solo Google Calendar (sin Gmail ni exportación `.ics`).

## Desarrollo

```bash
export PATH="$HOME/.local/node/bin:$PATH"
yarn install
yarn dev     # userscript dev con HMR
yarn build   # -> dist/add-to-google-calendar.user.js
```

Release: sube `version` en `vite.config.ts`, ejecuta `yarn build` y commitea `dist/` en `main`.

## Licencia

MIT © Gustavo Galvez
