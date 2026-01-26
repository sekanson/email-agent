import { google, calendar_v3 } from "googleapis";

/**
 * Google Calendar Integration for Zeno Email Agent
 * 
 * Enables:
 * - Checking availability (free/busy)
 * - Creating calendar events
 * - Listing upcoming events
 * - Sending meeting invites
 */

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: string[];
  meetLink?: string;
  location?: string;
  status: "confirmed" | "tentative" | "cancelled";
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface FreeBusyResult {
  busy: TimeSlot[];
  free: TimeSlot[];
}

export interface CreateEventParams {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: string[];
  location?: string;
  addMeetLink?: boolean;
  sendInvites?: boolean;
}

function getOAuth2Client(accessToken: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

/**
 * Get the user's upcoming events
 */
export async function getUpcomingEvents(
  accessToken: string,
  refreshToken: string,
  maxResults: number = 10,
  daysAhead: number = 7
): Promise<CalendarEvent[]> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = response.data.items || [];

  return events.map((event) => ({
    id: event.id!,
    summary: event.summary || "(No title)",
    description: event.description || undefined,
    start: new Date(event.start?.dateTime || event.start?.date || now),
    end: new Date(event.end?.dateTime || event.end?.date || now),
    attendees: event.attendees?.map((a) => a.email!).filter(Boolean),
    meetLink: event.hangoutLink || undefined,
    location: event.location || undefined,
    status: (event.status as "confirmed" | "tentative" | "cancelled") || "confirmed",
  }));
}

/**
 * Check availability (free/busy) for a time range
 */
export async function getFreeBusy(
  accessToken: string,
  refreshToken: string,
  startTime: Date,
  endTime: Date,
  userEmail: string
): Promise<FreeBusyResult> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      items: [{ id: userEmail }],
    },
  });

  const busySlots = response.data.calendars?.[userEmail]?.busy || [];

  const busy: TimeSlot[] = busySlots.map((slot) => ({
    start: new Date(slot.start!),
    end: new Date(slot.end!),
  }));

  // Calculate free slots (inverse of busy)
  const free: TimeSlot[] = [];
  let currentStart = startTime;

  for (const busySlot of busy) {
    if (currentStart < busySlot.start) {
      free.push({
        start: currentStart,
        end: busySlot.start,
      });
    }
    currentStart = busySlot.end > currentStart ? busySlot.end : currentStart;
  }

  // Add remaining time after last busy slot
  if (currentStart < endTime) {
    free.push({
      start: currentStart,
      end: endTime,
    });
  }

  return { busy, free };
}

/**
 * Find available slots for a meeting of given duration
 */
export async function findAvailableSlots(
  accessToken: string,
  refreshToken: string,
  userEmail: string,
  durationMinutes: number = 30,
  daysAhead: number = 5,
  workingHoursStart: number = 9, // 9 AM
  workingHoursEnd: number = 17   // 5 PM
): Promise<TimeSlot[]> {
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);

  const { free } = await getFreeBusy(accessToken, refreshToken, now, future, userEmail);

  const availableSlots: TimeSlot[] = [];
  const durationMs = durationMinutes * 60 * 1000;

  for (const slot of free) {
    let slotStart = new Date(slot.start);
    const slotEnd = slot.end;

    // Iterate through the free slot finding all valid meeting times
    while (slotStart.getTime() + durationMs <= slotEnd.getTime()) {
      const hour = slotStart.getHours();

      // Only include slots during working hours
      if (hour >= workingHoursStart && hour < workingHoursEnd) {
        const proposedEnd = new Date(slotStart.getTime() + durationMs);

        // Make sure end time is also within working hours
        if (proposedEnd.getHours() <= workingHoursEnd) {
          availableSlots.push({
            start: new Date(slotStart),
            end: proposedEnd,
          });
        }
      }

      // Move to next 30-minute slot
      slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
    }
  }

  // Return first 10 available slots
  return availableSlots.slice(0, 10);
}

/**
 * Create a calendar event
 */
export async function createEvent(
  accessToken: string,
  refreshToken: string,
  params: CreateEventParams
): Promise<CalendarEvent> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  const eventBody: calendar_v3.Schema$Event = {
    summary: params.summary,
    description: params.description,
    start: {
      dateTime: params.start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: params.end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    location: params.location,
  };

  // Add attendees if provided
  if (params.attendees && params.attendees.length > 0) {
    eventBody.attendees = params.attendees.map((email) => ({ email }));
  }

  // Add Google Meet link if requested
  if (params.addMeetLink) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: `zeno-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: eventBody,
    conferenceDataVersion: params.addMeetLink ? 1 : 0,
    sendUpdates: params.sendInvites ? "all" : "none",
  });

  const event = response.data;

  return {
    id: event.id!,
    summary: event.summary || params.summary,
    description: event.description || undefined,
    start: params.start,
    end: params.end,
    attendees: params.attendees,
    meetLink: event.hangoutLink || undefined,
    location: event.location || undefined,
    status: "confirmed",
  };
}

/**
 * Update an existing calendar event
 */
export async function updateEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  updates: Partial<CreateEventParams>,
  sendUpdates: boolean = true
): Promise<CalendarEvent> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  const updateBody: calendar_v3.Schema$Event = {};

  if (updates.summary) updateBody.summary = updates.summary;
  if (updates.description) updateBody.description = updates.description;
  if (updates.location) updateBody.location = updates.location;
  if (updates.start) {
    updateBody.start = {
      dateTime: updates.start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  if (updates.end) {
    updateBody.end = {
      dateTime: updates.end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  if (updates.attendees) {
    updateBody.attendees = updates.attendees.map((email) => ({ email }));
  }

  const response = await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody: updateBody,
    sendUpdates: sendUpdates ? "all" : "none",
  });

  const event = response.data;

  return {
    id: event.id!,
    summary: event.summary || "",
    description: event.description || undefined,
    start: new Date(event.start?.dateTime || event.start?.date || new Date()),
    end: new Date(event.end?.dateTime || event.end?.date || new Date()),
    attendees: event.attendees?.map((a) => a.email!).filter(Boolean),
    meetLink: event.hangoutLink || undefined,
    location: event.location || undefined,
    status: (event.status as "confirmed" | "tentative" | "cancelled") || "confirmed",
  };
}

/**
 * Delete/cancel a calendar event
 */
export async function deleteEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  sendUpdates: boolean = true
): Promise<void> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.delete({
    calendarId: "primary",
    eventId,
    sendUpdates: sendUpdates ? "all" : "none",
  });
}

/**
 * Accept a calendar invite
 */
export async function respondToEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  response: "accepted" | "declined" | "tentative",
  userEmail: string
): Promise<void> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  // Get current event
  const eventResponse = await calendar.events.get({
    calendarId: "primary",
    eventId,
  });

  const event = eventResponse.data;

  // Update attendee response
  const attendees = event.attendees?.map((attendee) => {
    if (attendee.email?.toLowerCase() === userEmail.toLowerCase()) {
      return { ...attendee, responseStatus: response };
    }
    return attendee;
  });

  await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody: { attendees },
    sendUpdates: "all",
  });
}

/**
 * Format time slots for display in emails/messages
 */
export function formatAvailableSlots(slots: TimeSlot[]): string {
  if (slots.length === 0) {
    return "No available slots found in the specified time range.";
  }

  const formatted = slots.map((slot, index) => {
    const startDate = slot.start.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const startTime = slot.start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const endTime = slot.end.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    return `${index + 1}. ${startDate} ${startTime} - ${endTime}`;
  });

  return formatted.join("\n");
}

/**
 * Parse natural language time into a Date
 * (Simple version - could be enhanced with a library like chrono-node)
 */
export function parseTimeExpression(
  expression: string,
  referenceDate: Date = new Date()
): Date | null {
  const lower = expression.toLowerCase().trim();

  // Handle "tomorrow at X"
  if (lower.includes("tomorrow")) {
    const date = new Date(referenceDate);
    date.setDate(date.getDate() + 1);

    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();

      if (meridiem === "pm" && hours < 12) hours += 12;
      if (meridiem === "am" && hours === 12) hours = 0;

      date.setHours(hours, minutes, 0, 0);
    } else {
      date.setHours(9, 0, 0, 0); // Default to 9 AM
    }

    return date;
  }

  // Handle "next [weekday]"
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const nextMatch = lower.match(/next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
  if (nextMatch) {
    const targetDay = weekdays.indexOf(nextMatch[1].toLowerCase());
    const date = new Date(referenceDate);
    const currentDay = date.getDay();
    const daysUntil = ((targetDay - currentDay + 7) % 7) || 7;
    date.setDate(date.getDate() + daysUntil);
    date.setHours(9, 0, 0, 0); // Default to 9 AM
    return date;
  }

  // Handle "in X hours/days"
  const inMatch = lower.match(/in\s+(\d+)\s+(hour|day|minute)s?/i);
  if (inMatch) {
    const amount = parseInt(inMatch[1]);
    const unit = inMatch[2].toLowerCase();
    const date = new Date(referenceDate);

    if (unit === "minute") date.setMinutes(date.getMinutes() + amount);
    if (unit === "hour") date.setHours(date.getHours() + amount);
    if (unit === "day") date.setDate(date.getDate() + amount);

    return date;
  }

  return null;
}
