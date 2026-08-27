import type Database from 'better-sqlite3';
import type { ChatStatsRecord, MessageRole } from '../../shared/ipc-types.js';

interface StatsMessageRow {
  role: MessageRole;
  created_at: number;
}

const EMPTY_STATS: ChatStatsRecord = {
  selfMessageCount: 0,
  otherMessageCount: 0,
  activeDays: 0,
  firstMessageAt: null,
  lastMessageAt: null,
  longestStreakDays: 0,
  longestSilenceMs: null,
  avgMessagesPerActiveDay: 0,
  hourDistribution: new Array(24).fill(0),
  weekdayDistribution: new Array(7).fill(0),
  selfInitiatedDays: 0,
  otherInitiatedDays: 0,
};

/** Local calendar day as a DST-safe integer key — built from local Y/M/D components (not the raw UTC ms), so two timestamps on the same local date always land on the same key regardless of time-of-day or DST shifts. */
function localDayIndex(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

/** Monday-first weekday index (0 = Mon … 6 = Sun) — JS's native getDay() is Sunday-first (0 = Sun), which would misalign against a 周一～周日 chart. */
function mondayFirstWeekday(timestamp: number): number {
  return (new Date(timestamp).getDay() + 6) % 7;
}

/**
 * Aggregates every stat on the 聊天统计 page for one chat card, from its
 * `role IN ('self', 'other')` messages — `annotation` rows are image/emoji
 * markers, not real dialogue, so they're excluded from every metric here
 * (message counts, active days, distributions, initiation, silence).
 */
export function computeChatStats(db: Database.Database, chatCardId: number): ChatStatsRecord {
  const rows = db
    .prepare(
      `SELECT role, created_at FROM message
       WHERE chat_card_id = ? AND role IN ('self', 'other')
       ORDER BY created_at ASC, id ASC`,
    )
    .all(chatCardId) as StatsMessageRow[];

  if (rows.length === 0) return EMPTY_STATS;

  let selfMessageCount = 0;
  let otherMessageCount = 0;
  const hourDistribution = new Array(24).fill(0);
  const weekdayDistribution = new Array(7).fill(0);
  // First message's role per local day, in first-seen order — drives both
  // the initiation tally and (via its sorted keys) the streak calculation.
  const firstRoleByDay = new Map<number, MessageRole>();

  let longestSilenceMs: number | null = null;
  let previousCreatedAt: number | null = null;

  for (const row of rows) {
    if (row.role === 'self') selfMessageCount += 1;
    else otherMessageCount += 1;

    hourDistribution[new Date(row.created_at).getHours()] += 1;
    weekdayDistribution[mondayFirstWeekday(row.created_at)] += 1;

    const dayKey = localDayIndex(row.created_at);
    if (!firstRoleByDay.has(dayKey)) firstRoleByDay.set(dayKey, row.role);

    if (previousCreatedAt !== null) {
      const gap = row.created_at - previousCreatedAt;
      if (longestSilenceMs === null || gap > longestSilenceMs) longestSilenceMs = gap;
    }
    previousCreatedAt = row.created_at;
  }

  const sortedDayKeys = Array.from(firstRoleByDay.keys()).sort((a, b) => a - b);
  let longestStreakDays = 1;
  let currentStreak = 1;
  for (let i = 1; i < sortedDayKeys.length; i++) {
    const prev = sortedDayKeys[i - 1] as number;
    const curr = sortedDayKeys[i] as number;
    currentStreak = curr - prev === 1 ? currentStreak + 1 : 1;
    if (currentStreak > longestStreakDays) longestStreakDays = currentStreak;
  }

  let selfInitiatedDays = 0;
  let otherInitiatedDays = 0;
  for (const role of firstRoleByDay.values()) {
    if (role === 'self') selfInitiatedDays += 1;
    else otherInitiatedDays += 1;
  }

  const activeDays = firstRoleByDay.size;
  const totalMessages = selfMessageCount + otherMessageCount;

  return {
    selfMessageCount,
    otherMessageCount,
    activeDays,
    firstMessageAt: rows[0]!.created_at,
    lastMessageAt: rows[rows.length - 1]!.created_at,
    longestStreakDays,
    longestSilenceMs,
    avgMessagesPerActiveDay: Math.round((totalMessages / activeDays) * 10) / 10,
    hourDistribution,
    weekdayDistribution,
    selfInitiatedDays,
    otherInitiatedDays,
  };
}
