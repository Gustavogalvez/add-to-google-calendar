export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  description?: string;
  url?: string;
}
