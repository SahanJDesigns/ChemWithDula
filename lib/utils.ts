import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TIMEZONE = 'Asia/Colombo';

/**
 * Convert a datetime-local input value to UTC ISO string
 * datetime-local values are in the format: "2026-04-11T10:30"
 */
export function localTimeToUTC(localTimeString: string): string {
  if (!localTimeString) return '';
  
  // Parse the datetime-local string
  const [date, time] = localTimeString.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  
  // Create a date in Asia/Colombo timezone
  // Use Intl to get the offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Create a date object and adjust for timezone
  const utcDate = new Date(year, month - 1, day, hours, minutes, 0);
  
  // Get the formatter parts
  const parts = formatter.formatToParts(utcDate);
  const tzYear = parseInt(parts.find(p => p.type === 'year')?.value || year.toString());
  const tzMonth = parseInt(parts.find(p => p.type === 'month')?.value || (month).toString());
  const tzDay = parseInt(parts.find(p => p.type === 'day')?.value || day.toString());
  const tzHours = parseInt(parts.find(p => p.type === 'hour')?.value || hours.toString());
  const tzMinutes = parseInt(parts.find(p => p.type === 'minute')?.value || minutes.toString());
  
  // Calculate offset
  const offset = new Date(year, month - 1, day, hours, minutes, 0).getTime() - 
                 new Date(tzYear, tzMonth - 1, tzDay, tzHours, tzMinutes, 0).getTime();
  
  const utcTime = new Date(utcDate.getTime() - offset);
  return utcTime.toISOString();
}

/**
 * Convert a UTC ISO string to datetime-local format (Asia/Colombo timezone)
 */
export function utcToLocalTime(utcString: string): string {
  if (!utcString) return '';
  
  const utcDate = new Date(utcString);
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(utcDate);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Get current time in Asia/Colombo timezone as datetime-local format
 */
export function getCurrentTimeInTimezone(): string {
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  
  return `${year}-${month}-${day}T${hour}:${minute}`;
}
