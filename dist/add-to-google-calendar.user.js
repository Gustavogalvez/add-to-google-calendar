// ==UserScript==
// @name         Add to Google Calendar
// @namespace    https://github.com/Gustavogalvez/add-to-google-calendar
// @version      0.1.0
// @author       Gustavo Galvez (Gustavogalvez)
// @description  Detects events (JSON-LD) on ticket and event pages and adds a button to send them to Google Calendar.
// @license      MIT
// @homepageURL  https://github.com/Gustavogalvez/add-to-google-calendar
// @supportURL   https://github.com/Gustavogalvez/add-to-google-calendar/issues
// @downloadURL  https://raw.githubusercontent.com/Gustavogalvez/add-to-google-calendar/main/dist/add-to-google-calendar.user.js
// @updateURL    https://raw.githubusercontent.com/Gustavogalvez/add-to-google-calendar/main/dist/add-to-google-calendar.user.js
// @match        *://*/*
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function() {
	"use strict";
	function collapse(value) {
		return value.replace(/\s+/g, " ").trim();
	}
	function truncate(value, max) {
		return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
	}
	var DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
	var DEFAULT_DURATION_MS = 72e5;
	var MAX_TITLE = 200;
	var MAX_DESCRIPTION = 1200;
	function asText(value) {
		if (Array.isArray(value)) {
			for (const entry of value) {
				const text = asText(entry);
				if (text) return text;
			}
			return;
		}
		if (typeof value === "string") return collapse(value) || void 0;
		if (typeof value === "number") return String(value);
		if (typeof value === "object" && value !== null) return asText(value["@value"]);
	}
	function plainText(value) {
		return collapse(new DOMParser().parseFromString(value, "text/html").body.textContent ?? "") || void 0;
	}
	function parseDateOnly(value) {
		const [year, month, day] = value.split("-").map(Number);
		if (!year || !month || !day) return null;
		const date = new Date(year, month - 1, day);
		return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
	}
	function parseStart(value) {
		if (DATE_ONLY.test(value)) {
			const date = parseDateOnly(value);
			return date ? {
				date,
				allDay: true
			} : null;
		}
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? null : {
			date,
			allDay: false
		};
	}
	function addDays(date, days) {
		const next = new Date(date);
		next.setDate(next.getDate() + days);
		return next;
	}
	function resolveEnd(raw, start, allDay) {
		if (raw) {
			const parsed = allDay && DATE_ONLY.test(raw) ? parseDateOnly(raw) : new Date(raw);
			if (parsed && !Number.isNaN(parsed.getTime()) && parsed.getTime() > start.getTime()) return allDay ? addDays(parsed, 1) : parsed;
		}
		return allDay ? addDays(start, 1) : new Date(start.getTime() + DEFAULT_DURATION_MS);
	}
	function addressToString(value) {
		if (typeof value === "string") return asText(value);
		if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
		const record = value;
		const parts = [
			record.streetAddress,
			record.addressLocality,
			record.addressRegion,
			record.postalCode,
			record.addressCountry
		].map(asText).filter((part) => Boolean(part));
		return parts.length > 0 ? parts.join(", ") : void 0;
	}
	function placeToString(value) {
		if (typeof value === "string") return asText(value);
		if (Array.isArray(value)) {
			const parts = value.map(placeToString).filter((part) => Boolean(part));
			return parts.length > 0 ? parts.join(" · ") : void 0;
		}
		if (typeof value !== "object" || value === null) return void 0;
		const record = value;
		const parts = [asText(record.name), addressToString(record.address)].filter((part) => Boolean(part));
		return parts.length > 0 ? parts.join(", ") : void 0;
	}
	function resolveUrl(value) {
		if (typeof value !== "string") return void 0;
		try {
			const url = new URL(value, window.location.href);
			return url.protocol === "http:" || url.protocol === "https:" ? url.href : void 0;
		} catch {
			return;
		}
	}
	function pageUrl() {
		const { origin, pathname, search } = window.location;
		return `${origin}${pathname}${search}`;
	}
	function toCalendarEvent(node) {
		const title = asText(node.name);
		const startRaw = asText(node.startDate);
		if (!title || !startRaw) return null;
		const start = parseStart(startRaw);
		if (!start) return null;
		const event = {
			title: truncate(title, MAX_TITLE),
			start: start.date,
			end: resolveEnd(asText(node.endDate), start.date, start.allDay),
			allDay: start.allDay,
			url: resolveUrl(node.url) ?? pageUrl()
		};
		const location = placeToString(node.location);
		if (location) event.location = location;
		const description = asText(node.description);
		if (description) {
			const details = plainText(description);
			if (details) event.description = truncate(details, MAX_DESCRIPTION);
		}
		return event;
	}
	var NESTED_KEYS = [
		"@graph",
		"itemListElement",
		"item",
		"mainEntity",
		"subEvent",
		"events"
	];
	function isNode(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value);
	}
	function extractJsonLd(root) {
		const nodes = [];
		for (const script of root.querySelectorAll("script[type=\"application/ld+json\"]")) {
			const raw = script.textContent?.trim();
			if (!raw) continue;
			try {
				walk(JSON.parse(raw), nodes);
			} catch {
				continue;
			}
		}
		return nodes;
	}
	function walk(value, out) {
		if (Array.isArray(value)) {
			for (const entry of value) walk(entry, out);
			return;
		}
		if (!isNode(value)) return;
		out.push(value);
		for (const key of NESTED_KEYS) if (key in value) walk(value[key], out);
	}
	function isEventNode(node) {
		const raw = node["@type"];
		return (Array.isArray(raw) ? raw : [raw]).some((type) => typeof type === "string" && /(?:^|[/#])[A-Za-z]*Event$/.test(type));
	}
	var MAX_EVENTS = 20;
	var PAST_GRACE_MS = 864e5;
	function detectEvents(root = document) {
		const seen = new Set();
		const events = [];
		for (const node of extractJsonLd(root)) {
			if (!isEventNode(node)) continue;
			const event = toCalendarEvent(node);
			if (!event) continue;
			const key = `${event.title}|${event.start.getTime()}|${event.location ?? ""}`;
			if (seen.has(key)) continue;
			seen.add(key);
			events.push(event);
		}
		events.sort((a, b) => a.start.getTime() - b.start.getTime());
		const upcoming = events.filter((event) => event.end.getTime() >= Date.now() - PAST_GRACE_MS);
		return (upcoming.length > 0 ? upcoming : events).slice(0, MAX_EVENTS);
	}
	var MAX_DETAILS = 1800;
	function pad(value) {
		return String(value).padStart(2, "0");
	}
	function formatDay(date) {
		return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
	}
	function formatDateTime(date) {
		return `${formatDay(date)}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
	}
	function googleCalendarUrl(event) {
		const dates = event.allDay ? `${formatDay(event.start)}/${formatDay(event.end)}` : `${formatDateTime(event.start)}/${formatDateTime(event.end)}`;
		const params = new URLSearchParams({
			action: "TEMPLATE",
			text: event.title,
			dates
		});
		if (event.location) params.set("location", event.location);
		const details = [event.description, event.url].filter((value) => Boolean(value)).join("\n\n");
		if (details) params.set("details", truncate(details, MAX_DETAILS));
		if (!event.allDay) {
			const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (timeZone) params.set("ctz", timeZone);
		}
		return `https://calendar.google.com/calendar/render?${params.toString()}`;
	}
	var HOST_ID = "gcal-event-helper";
	var ICON = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"4.5\" width=\"18\" height=\"16\" rx=\"2.5\"/><path d=\"M3 9.5h18M8 2.5v4M16 2.5v4\"/></svg>";
	var STYLE = `
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
	function formatWhen(event) {
		return new Intl.DateTimeFormat("es-ES", event.allDay ? { dateStyle: "full" } : {
			dateStyle: "medium",
			timeStyle: "short"
		}).format(event.start);
	}
	var EventWidget = class {
		host = null;
		wrap = null;
		events = [];
		panelOpen = false;
		constructor() {
			document.addEventListener("click", this.handleDocumentClick, true);
			document.addEventListener("keydown", this.handleKeyDown);
		}
		render(events) {
			this.events = events;
			if (events.length === 0) {
				this.remove();
				return;
			}
			this.ensureHost();
			this.panelOpen = false;
			this.renderContent();
		}
		contains(node) {
			return Boolean(this.host && (node === this.host || this.host.contains(node)));
		}
		remove() {
			this.host?.remove();
			this.host = null;
			this.wrap = null;
			this.events = [];
			this.panelOpen = false;
		}
		handleDocumentClick = (event) => {
			if (!this.panelOpen || !this.host) return;
			if (event.composedPath().includes(this.host)) return;
			this.openPanel(false);
		};
		handleKeyDown = (event) => {
			if (event.key === "Escape" && this.panelOpen) this.openPanel(false);
		};
		ensureHost() {
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
		openPanel(open) {
			this.panelOpen = open;
			this.renderContent();
		}
		openEvent(event) {
			window.open(googleCalendarUrl(event), "_blank", "noopener,noreferrer");
			if (this.panelOpen) this.openPanel(false);
		}
		renderContent() {
			const wrap = this.wrap;
			if (!wrap) return;
			wrap.replaceChildren();
			const multiple = this.events.length > 1;
			if (multiple && this.panelOpen) wrap.append(this.buildPanel());
			wrap.append(this.buildButton(multiple));
		}
		buildButton(multiple) {
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
		buildPanel() {
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
	};
	var DEBOUNCE_MS = 400;
	var widget = new EventWidget();
	var signature = "";
	var timer;
	function signatureOf(events) {
		return events.map((event) => [
			event.title,
			event.start.getTime(),
			event.end.getTime(),
			event.location ?? "",
			event.url ?? ""
		].join("|")).join("~");
	}
	function refresh() {
		const events = detectEvents();
		const next = signatureOf(events);
		if (next === signature) return;
		signature = next;
		widget.render(events);
	}
	function schedule() {
		if (timer !== void 0) window.clearTimeout(timer);
		timer = window.setTimeout(() => {
			timer = void 0;
			refresh();
		}, DEBOUNCE_MS);
	}
	function start() {
		refresh();
		new MutationObserver((records) => {
			if (records.every((record) => widget.contains(record.target))) return;
			schedule();
		}).observe(document.documentElement, {
			childList: true,
			subtree: true
		});
		window.addEventListener("popstate", schedule);
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
	else start();
})();
