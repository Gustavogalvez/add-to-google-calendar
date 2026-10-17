import { truncate } from "./text";
import type { CalendarEvent } from "./types";

const MAX_DETAILS = 1800;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDay(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function formatDateTime(date: Date): string {
  return `${formatDay(date)}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const dates = event.allDay ? `${formatDay(event.start)}/${formatDay(event.end)}` : `${formatDateTime(event.start)}/${formatDateTime(event.end)}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates });

  if (event.location) params.set("location", event.location);

  const details = [event.description, event.url].filter((value): value is string => Boolean(value)).join("\n\n");
  if (details) params.set("details", truncate(details, MAX_DETAILS));

  if (!event.allDay) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) params.set("ctz", timeZone);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
