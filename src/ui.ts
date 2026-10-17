import { googleCalendarUrl } from "./calendar";
import { collapse } from "./text";
import type { CalendarEvent } from "./types";

const HOST_ID = "gcal-event-helper";
const ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>';

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; }
.wrap {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #f5f5f7;
}
.fab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 16px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(22, 24, 29, 0.88);
  color: #f5f5f7;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
}
.fab:hover { background: rgba(35, 38, 45, 0.95); transform: translateY(-1px); }
.fab:active { transform: translateY(0); }
.fab:focus-visible { outline: 2px solid #8ab4f8; outline-offset: 2px; }
.fab svg { width: 18px; height: 18px; flex: none; }
.count {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #8ab4f8;
  color: #111318;
  font-size: 12px;
  text-align: center;
}
.panel {
  width: min(360px, calc(100vw - 36px));
  max-height: min(60vh, 420px);
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 14px;
  background: rgba(22, 24, 29, 0.96);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(16px);
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #c7c9d1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.close {
  border: 0;
  border-radius: 6px;
  background: none;
  color: #c7c9d1;
  font: inherit;
  font-size: 20px;
  line-height: 1;
  padding: 0 4px;
  cursor: pointer;
}
.close:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
.list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; }
.row {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 10px;
  border: 0;
  border-radius: 9px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.row:hover, .row:focus-visible { background: rgba(138, 180, 248, 0.14); outline: none; }
.row-title { font-size: 13px; font-weight: 600; }
.row-meta { font-size: 12px; color: #a9adb8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

function formatWhen(event: CalendarEvent): string {
  const formatter = new Intl.DateTimeFormat("es-ES", event.allDay ? { dateStyle: "full" } : { dateStyle: "medium", timeStyle: "short" });
  return formatter.format(event.start);
}

export class EventWidget {
  private host: HTMLDivElement | null = null;
  private wrap: HTMLDivElement | null = null;
  private events: CalendarEvent[] = [];
  private panelOpen = false;

  constructor() {
    document.addEventListener("click", this.handleDocumentClick, true);
    document.addEventListener("keydown", this.handleKeyDown);
  }

  render(events: CalendarEvent[]): void {
    this.events = events;
    if (events.length === 0) {
      this.remove();
      return;
    }
    this.ensureHost();
    this.panelOpen = false;
    this.renderContent();
  }

  contains(node: Node): boolean {
    return Boolean(this.host && (node === this.host || this.host.contains(node)));
  }

  remove(): void {
    this.host?.remove();
    this.host = null;
    this.wrap = null;
    this.events = [];
    this.panelOpen = false;
  }

  private readonly handleDocumentClick = (event: MouseEvent): void => {
    if (!this.panelOpen || !this.host) return;
    if (event.composedPath().includes(this.host)) return;
    this.openPanel(false);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.panelOpen) this.openPanel(false);
  };

  private ensureHost(): void {
    if (this.host?.isConnected && this.wrap) return;
    const host = document.createElement("div");
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    shadow.append(style, wrap);
    (document.body ?? document.documentElement).append(host);
    this.host = host;
    this.wrap = wrap;
  }

  private openPanel(open: boolean): void {
    this.panelOpen = open;
    this.renderContent();
  }

  private openEvent(event: CalendarEvent): void {
    window.open(googleCalendarUrl(event), "_blank", "noopener,noreferrer");
    if (this.panelOpen) this.openPanel(false);
  }

  private renderContent(): void {
    const wrap = this.wrap;
    if (!wrap) return;
    wrap.replaceChildren();
    const multiple = this.events.length > 1;
    if (multiple && this.panelOpen) wrap.append(this.buildPanel());
    wrap.append(this.buildButton(multiple));
  }

  private buildButton(multiple: boolean): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fab";
    button.innerHTML = ICON;
    const label = document.createElement("span");
    label.textContent = "Añadir al calendario";
    button.append(label);

    if (multiple) {
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = String(this.events.length);
      button.append(count);
      button.setAttribute("aria-haspopup", "true");
      button.setAttribute("aria-expanded", String(this.panelOpen));
    }

    button.addEventListener("click", () => {
      if (multiple) {
        this.openPanel(!this.panelOpen);
        return;
      }
      const [event] = this.events;
      if (event) this.openEvent(event);
    });

    return button;
  }

  private buildPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Eventos detectados");

    const head = document.createElement("div");
    head.className = "panel-head";
    const title = document.createElement("span");
    title.textContent = "Elegir evento";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("aria-label", "Cerrar");
    close.textContent = "×";
    close.addEventListener("click", () => this.openPanel(false));
    head.append(title, close);

    const list = document.createElement("ul");
    list.className = "list";
    for (const event of this.events) {
      const item = document.createElement("li");
      const row = document.createElement("button");
      row.type = "button";
      row.className = "row";
      const rowTitle = document.createElement("span");
      rowTitle.className = "row-title";
      rowTitle.textContent = event.title;
      const meta = document.createElement("span");
      meta.className = "row-meta";
      meta.textContent = collapse([formatWhen(event), event.location].filter(Boolean).join(" · "));
      row.append(rowTitle, meta);
      row.addEventListener("click", () => this.openEvent(event));
      item.append(row);
      list.append(item);
    }

    panel.append(head, list);
    return panel;
  }
}
