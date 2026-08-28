export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

interface TavilySearchResponse {
  results?: Array<{ title?: string; url?: string; content?: string }>;
}

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const MAX_RESULTS = 5;

/**
 * Overridable so the E2E suite can point this at a local mock server instead
 * of the real Tavily API — same pattern as `E2E_USER_DATA_DIR` in
 * electron/main/index.ts for the app's data directory.
 */
function resolveSearchUrl(): string {
  return process.env.E2E_TAVILY_BASE_URL ?? TAVILY_SEARCH_URL;
}

/** Queries Tavily's search API. Throws on any network/auth/HTTP failure — callers decide how to degrade. */
export async function searchWeb(apiKey: string, query: string): Promise<WebSearchResult[]> {
  const response = await fetch(resolveSearchUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, max_results: MAX_RESULTS }),
  });

  if (!response.ok) {
    throw new Error(`Tavily 搜索失败：HTTP ${response.status}`);
  }

  const data = (await response.json()) as TavilySearchResponse;
  return (data.results ?? [])
    .filter((item): item is { title: string; url: string; content: string } =>
      Boolean(item.title && item.url && item.content),
    )
    .slice(0, MAX_RESULTS)
    .map((item) => ({ title: item.title, url: item.url, content: item.content }));
}

/** Formats search results into the prompt-ready text block generateReplies.ts injects under 【实时搜索结果】. */
export function formatSearchResults(results: WebSearchResult[]): string {
  return results.map((result, index) => `${index + 1}. ${result.title}\n${result.content}\n来源：${result.url}`).join('\n\n');
}
