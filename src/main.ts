import { detectEvents } from "./detect";
import type { CalendarEvent } from "./types";
import { EventWidget } from "./ui";

const DEBOUNCE_MS = 400;

const widget = new EventWidget();
let signature = "";
let timer: number | undefined;

function signatureOf(events: CalendarEvent[]): string {
  return events.map((event) => [event.title, event.start.getTime(), event.end.getTime(), event.location ?? "", event.url ?? ""].join("|")).join("~");
}

function refresh(): void {
  const events = detectEvents();
  const next = signatureOf(events);
  if (next === signature) return;
  signature = next;
  widget.render(events);
}

function schedule(): void {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = undefined;
    refresh();
  }, DEBOUNCE_MS);
}

function start(): void {
  refresh();
  const observer = new MutationObserver((records) => {
    if (records.every((record) => widget.contains(record.target))) return;
    schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", schedule);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
