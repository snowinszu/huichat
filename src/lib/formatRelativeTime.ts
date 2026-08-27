/** "刚刚" / "N分钟前" / "N小时前" / "N天前", matching the card-time labels in the design. Falls back to a plain date past 30 days. */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diffMs = now - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return '刚刚';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}分钟前`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}小时前`;
  if (diffMs < 30 * day) return `${Math.floor(diffMs / day)}天前`;

  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
