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

export interface MultiCalendarResult {
  userBusy: TimeSlot[];
  attendeeBusy: { [email: string]: TimeSlot[] };
  attendeeErrors: { [email: string]: string };
  combinedBusy: TimeSlot[];
  suggestedSlots: TimeSlot[];
}

/**
 * Check availability for user AND attendees (with graceful fallback for external users)
 */
export async function checkMultipleCalendars(
  accessToken: string,
  refreshToken: string,
  startTime: Date,
  endTime: Date,
  userEmail: string,
  attendeeEmails: string[],
  durationMinutes: number = 30
): Promise<MultiCalendarResult> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  // Query all calendars at once
  const allEmails = [userEmail, ...attendeeEmails];
  
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      items: allEmails.map(email => ({ id: email })),
    },
  });

  const calendars = response.data.calendars || {};
  
  // Extract user's busy times
  const userBusy: TimeSlot[] = (calendars[userEmail]?.busy || []).map(slot => ({
    start: new Date(slot.start!),
    end: new Date(slot.end!),
  }));

  // Extract attendee busy times (with error handling for external users)
  const attendeeBusy: { [email: string]: TimeSlot[] } = {};
  const attendeeErrors: { [email: string]: string } = {};

  for (const email of attendeeEmails) {
    const calData = calendars[email];
    if (calData?.errors && calData.errors.length > 0) {
      // External user or no access
      attendeeErrors[email] = calData.errors[0].reason || "Unable to check calendar";
    } else {
      attendeeBusy[email] = (calData?.busy || []).map(slot => ({
        start: new Date(slot.start!),
        end: new Date(slot.end!),
      }));
    }
  }

  // Combine all busy times
  const allBusySlots: TimeSlot[] = [
    ...userBusy,
    ...Object.values(attendeeBusy).flat(),
  ];

  // Sort and merge overlapping busy slots
  const combinedBusy = mergeOverlappingSlots(allBusySlots);

  // Find available slots
  const suggestedSlots = findFreeSlots(startTime, endTime, combinedBusy, durationMinutes);

  return {
    userBusy,
    attendeeBusy,
    attendeeErrors,
    combinedBusy,
    suggestedSlots,
  };
}

/**
 * Merge overlapping time slots
 */
function mergeOverlappingSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return [];

  // Sort by start time
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  const merged: TimeSlot[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start.getTime() <= last.end.getTime()) {
      // Overlapping - extend the end time if needed
      if (current.end.getTime() > last.end.getTime()) {
        last.end = current.end;
      }
    } else {
      // No overlap - add new slot
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Find free slots of given duration within a time range
 */
function findFreeSlots(
  startTime: Date,
  endTime: Date,
  busySlots: TimeSlot[],
  durationMinutes: number,
  workingHoursStart: number = 9,
  workingHoursEnd: number = 17
): TimeSlot[] {
  const freeSlots: TimeSlot[] = [];
  const durationMs = durationMinutes * 60 * 1000;
  
  let currentStart = new Date(startTime);

  for (const busy of busySlots) {
    // Check gap before this busy slot
    while (currentStart.getTime() + durationMs <= busy.start.getTime()) {
      const hour = currentStart.getHours();
      
      // Only during working hours
      if (hour >= workingHoursStart && hour < workingHoursEnd) {
        const slotEnd = new Date(currentStart.getTime() + durationMs);
        if (slotEnd.getHours() <= workingHoursEnd) {
          freeSlots.push({
            start: new Date(currentStart),
            end: slotEnd,
          });
        }
      }
      
      // Move to next 30-min slot
      currentStart = new Date(currentStart.getTime() + 30 * 60 * 1000);
    }
    
    // Skip past this busy slot
    if (busy.end.getTime() > currentStart.getTime()) {
      currentStart = new Date(busy.end);
    }
  }

  // Check remaining time after last busy slot
  while (currentStart.getTime() + durationMs <= endTime.getTime() && freeSlots.length < 5) {
    const hour = currentStart.getHours();
    
    if (hour >= workingHoursStart && hour < workingHoursEnd) {
      const slotEnd = new Date(currentStart.getTime() + durationMs);
      if (slotEnd.getHours() <= workingHoursEnd) {
        freeSlots.push({
          start: new Date(currentStart),
          end: slotEnd,
        });
      }
    }
    
    currentStart = new Date(currentStart.getTime() + 30 * 60 * 1000);
  }

  return freeSlots.slice(0, 5); // Return top 5 suggestions
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

  // Handle ISO date format "YYYY-MM-DD HH:MM" or "YYYY-MM-DD"
  const isoMatch = expression.match(/(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (isoMatch) {
    const [, dateStr, hours, minutes] = isoMatch;
    const date = new Date(dateStr + "T12:00:00"); // Use noon to avoid timezone issues

    if (hours && minutes) {
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      date.setHours(9, 0, 0, 0); // Default to 9 AM
    }

    return date;
  }

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

  // Handle "[next] [weekday]" or just "[weekday]"
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const weekdayMatch = lower.match(/(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
  if (weekdayMatch) {
    const targetDay = weekdays.indexOf(weekdayMatch[1].toLowerCase());
    const date = new Date(referenceDate);
    const currentDay = date.getDay();
    
    // Calculate days until target day
    let daysUntil = (targetDay - currentDay + 7) % 7;
    // If it's the same day or "next" was specified, go to next week
    if (daysUntil === 0 || lower.includes("next")) {
      daysUntil = 7;
    }
    
    date.setDate(date.getDate() + daysUntil);
    
    // Parse time if specified, otherwise default to 10 AM (reasonable meeting time)
    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();
      
      if (meridiem === "pm" && hours < 12) hours += 12;
      if (meridiem === "am" && hours === 12) hours = 0;
      if (!meridiem && hours < 8) hours += 12; // Assume PM for times like "2" or "3"
      
      date.setHours(hours, minutes, 0, 0);
    } else {
      date.setHours(10, 0, 0, 0); // Default to 10 AM local time
    }
    
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
