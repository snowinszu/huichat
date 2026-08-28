import type { WebSearchResult } from './webSearch.js';

interface CacheEntry {
  lastMessageId: number;
  results: WebSearchResult[];
}

// One entry per chat card — regenerating replies for the same still-unanswered
// message (the common "重新生成" case, which re-runs reply:generate without
// any new message being added) should reuse the search that already ran
// instead of re-querying Tavily for what will be near-identical results.
// Keyed only by the last message's id (NOT the search query the model
// proposes) — a real LLM rarely phrases the same search query identically
// across repeated calls, so keying on exact query equality made this a
// near-permanent cache miss in practice. "Same last message" is what the
// user actually means by "already searched this" regardless of how the
// model worded the query this time around. Pasting a new incoming message
// naturally invalidates the stale entry the next time this card searches.
// In-memory only and one slot per card by design: no persistence needed,
// this only exists to dedupe repeats within a single running session.
const cache = new Map<number, CacheEntry>();

export function getCachedSearchResults(chatCardId: number, lastMessageId: number): WebSearchResult[] | null {
  const entry = cache.get(chatCardId);
  if (!entry || entry.lastMessageId !== lastMessageId) return null;
  return entry.results;
}

export function setCachedSearchResults(chatCardId: number, lastMessageId: number, results: WebSearchResult[]): void {
  cache.set(chatCardId, { lastMessageId, results });
}
