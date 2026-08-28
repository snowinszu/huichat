import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Minimal stand-in for Tavily's `/search` endpoint, so the E2E suite never
 * needs a real Tavily key or network access. `webSearch.ts` posts
 * `{ query, max_results }` and reads back `{ results: [{ title, url,
 * content }] }` — see electron/main/llm/webSearch.ts for the exact contract
 * (verified against the real API while building it).
 */
export type MockTavilyResponder = (
  query: string,
) => { results: Array<{ title: string; url: string; content: string }> } | { error: true; status?: number };

export interface MockTavilyServerHandle {
  /** Full `/search` endpoint URL — pass as `E2E_TAVILY_BASE_URL` when launching the app. */
  url: string;
  setResponder(responder: MockTavilyResponder): void;
  requestCount(): number;
  close(): Promise<void>;
}

export async function startMockTavilyServer(initialResponder: MockTavilyResponder): Promise<MockTavilyServerHandle> {
  let responder = initialResponder;
  let requests = 0;

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      requests += 1;
      let query = '';
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { query?: unknown };
        query = typeof body.query === 'string' ? body.query : '';
      } catch {
        // Malformed body — the responder decides what (if anything) to say about that.
      }

      const result = responder(query);
      if (!('results' in result)) {
        res.writeHead(result.status ?? 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'mock tavily failure' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ query, results: result.results }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/search`,
    setResponder(next) {
      responder = next;
    },
    requestCount() {
      return requests;
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
