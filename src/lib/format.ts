// ── Number / date formatters ─────────────────────────────────────

export function clampHoursTarget(value: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 20;
  return Math.min(100, Math.max(1, Math.round(numeric)));
}

export function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function formatDate(value: string | null): string {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatDaysLeft(days: number | null): string {
  if (days === null) return "No deadline set";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return `${days}d left`;
}

// ── Form helpers ─────────────────────────────────────────────────

export function toNullable(value: string): string | null {
  return value.trim().length > 0 ? value.trim() : null;
}

/** For `type="datetime-local"` inputs (returns YYYY-MM-DDTHH:mm) */
export function toDateInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

/** For `type="date"` inputs (returns YYYY-MM-DD) */
export function toLocalDateInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function toNullableIso(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

// ── Greeting ─────────────────────────────────────────────────────

export function getTimeGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}
