import type { JsonLdNode } from "./jsonld";
import { collapse, truncate } from "./text";
import type { CalendarEvent } from "./types";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;
const MAX_TEXT = 10000;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1200;
const MAX_DESCRIPTION_RAW = 4000;
const MAX_LOCATION = 300;

function asText(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = asText(entry);
      if (text) return text;
    }
    return undefined;
  }
  if (typeof value === "string") {
    const text = collapse(value.length > MAX_TEXT ? value.slice(0, MAX_TEXT) : value);
    return text || undefined;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null) {
    return asText((value as Record<string, unknown>)["@value"]);
  }
  return undefined;
}

function plainText(value: string): string | undefined {
  const parsed = new DOMParser().parseFromString(value, "text/html");
  const text = collapse(parsed.body.textContent ?? "");
  return text || undefined;
}

function parseDateOnly(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : null;
}

function parseStart(value: string): { date: Date; allDay: boolean } | null {
  if (DATE_ONLY.test(value)) {
    const date = parseDateOnly(value);
    return date ? { date, allDay: true } : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : { date, allDay: false };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function resolveEnd(raw: string | undefined, start: Date, allDay: boolean): Date {
  if (raw) {
    const parsed = allDay && DATE_ONLY.test(raw) ? parseDateOnly(raw) : new Date(raw);
    if (parsed && !Number.isNaN(parsed.getTime()) && parsed.getTime() > start.getTime()) {
      return allDay ? addDays(parsed, 1) : parsed;
    }
  }
  return allDay ? addDays(start, 1) : new Date(start.getTime() + DEFAULT_DURATION_MS);
}

function addressToString(value: unknown): string | undefined {
  if (typeof value === "string") return asText(value);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const parts = [record.streetAddress, record.addressLocality, record.addressRegion, record.postalCode, record.addressCountry]
    .map(asText)
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function placeToString(value: unknown): string | undefined {
  if (typeof value === "string") return asText(value);
  if (Array.isArray(value)) {
    const parts = value.map(placeToString).filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const parts = [asText(record.name), addressToString(record.address)].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function resolveUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function pageUrl(): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}`;
}

export function toCalendarEvent(node: JsonLdNode): CalendarEvent | null {
  const title = asText(node.name);
  const startRaw = asText(node.startDate);
  if (!title || !startRaw) return null;
  const start = parseStart(startRaw);
  if (!start) return null;

  const event: CalendarEvent = {
    title: truncate(title, MAX_TITLE),
    start: start.date,
    end: resolveEnd(asText(node.endDate), start.date, start.allDay),
    allDay: start.allDay,
    url: resolveUrl(node.url) ?? pageUrl(),
  };

  const location = placeToString(node.location);
  if (location) event.location = truncate(location, MAX_LOCATION);

  const description = asText(node.description);
  if (description) {
    const details = plainText(truncate(description, MAX_DESCRIPTION_RAW));
    if (details) event.description = truncate(details, MAX_DESCRIPTION);
  }

  return event;
}
