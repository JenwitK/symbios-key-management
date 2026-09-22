// Datetime-local <input> helpers, fixed to Asia/Bangkok (UTC+7, no DST) to
// match every dashboard page's display timezone.

/** ISO timestamp -> "YYYY-MM-DDTHH:mm" in Bangkok time, for a datetime-local input. */
export function toBangkokInputValue(iso: string | null): string {
  if (!iso) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

const INPUT_VALUE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "YYYY-MM-DDTHH:mm" (Bangkok wall-clock) -> ISO timestamp, or null when empty or invalid. */
export function fromBangkokInputValue(value: string): string | null {
  if (!value) return null;

  // Some browsers include seconds ("...T15:30:00"); drop them before validating.
  const trimmed = value.length > 16 ? value.slice(0, 16) : value;
  if (!INPUT_VALUE_RE.test(trimmed)) return null;

  const date = new Date(`${trimmed}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const MS_PER_MINUTE = 1000 * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

/** Relative countdown to an ISO timestamp: "Expired", "in <1m", "in Xm", "in Xh", or "in N day(s)". */
export function expiryCountdown(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "Expired";
  if (diffMs < MS_PER_MINUTE) return "in <1m";
  if (diffMs < MS_PER_HOUR) return `in ${Math.floor(diffMs / MS_PER_MINUTE)}m`;
  if (diffMs < MS_PER_DAY) return `in ${Math.floor(diffMs / MS_PER_HOUR)}h`;
  const diffDays = Math.floor(diffMs / MS_PER_DAY);
  return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}
