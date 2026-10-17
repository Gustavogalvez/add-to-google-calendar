import { toCalendarEvent } from "./event";
import { extractJsonLd, isEventNode } from "./jsonld";
import type { CalendarEvent } from "./types";

const MAX_EVENTS = 20;
const PAST_GRACE_MS = 24 * 60 * 60 * 1000;

export function detectEvents(root: ParentNode = document): CalendarEvent[] {
  const seen = new Set<string>();
  const events: CalendarEvent[] = [];

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
