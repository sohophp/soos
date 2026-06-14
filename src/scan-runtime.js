export function clampProgressValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(100, numericValue));
}

export function formatElapsedTime(elapsedMs) {
  const numericValue = Number(elapsedMs);
  const totalSeconds = Number.isFinite(numericValue)
    ? Math.max(0, Math.floor(numericValue / 1000))
    : 0;
  if (totalSeconds < 60) return `${totalSeconds}s`;
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

export function formatStartedTime(startedAt, locale) {
  if (!startedAt) return "-";
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString(locale);
}
