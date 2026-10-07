const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// "45m", "3h 12m", "2d 4h"
export function formatDuration(ms: number): string {
  if (ms < HOUR) return `${Math.max(0, Math.floor(ms / MINUTE))}m`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ${Math.floor((ms % HOUR) / MINUTE)}m`;
  return `${Math.floor(ms / DAY)}d ${Math.floor((ms % DAY) / HOUR)}h`;
}

export function durationSince(from: Date, to: Date = new Date()): string {
  return formatDuration(to.getTime() - from.getTime());
}

export function formatAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  return ms < MINUTE ? "just now" : `${formatDuration(ms)} ago`;
}

// Server-rendered, so it's pinned to UTC rather than whatever zone the server runs in.
export function formatDateTime(date: Date): string {
  return `${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })} UTC`;
}
