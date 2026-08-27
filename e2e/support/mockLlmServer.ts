import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A minimal stand-in for an OpenAI-compatible `/chat/completions` endpoint,
 * so the E2E suite never needs a real API key or network access. The app's
 * LLM client (`electron/main/llm/client.ts`, via pi-ai) always requests
 * `stream: true`, so responses must be real SSE `chat.completion.chunk`
 * frames — not a single JSON blob — for the official `openai` SDK's
 * streaming parser to accept them.
 *
 * `respond` maps the last user message (the actual prompt `callLlm` sent)
 * to a canned reply. Returning `{ error: true }` instead simulates a failed
 * call — e.g. an invalid API key — by responding with a non-2xx status
 * before any streaming begins, which is how a real auth failure looks to
 * the client.
 */
export type MockLlmResponder = (promptText: string) => string | { error: true; status?: number; message?: string };

export interface MockLlmServerHandle {
  url: string;
  setResponder(responder: MockLlmResponder): void;
  requestCount(): number;
  close(): Promise<void>;
}

function sseChunk(id: string, delta: Record<string, unknown>, finishReason: string | null): string {
  const payload = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'mock-model',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function startMockLlmServer(initialResponder: MockLlmResponder): Promise<MockLlmServerHandle> {
  let responder = initialResponder;
  let requests = 0;

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      requests += 1;
      let promptText = '';
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          messages?: Array<{ role: string; content: unknown }>;
        };
        const lastUserMessage = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user');
        promptText = typeof lastUserMessage?.content === 'string' ? lastUserMessage.content : '';
      } catch {
        // Malformed body — fall through with an empty prompt; the responder
        // decides what (if anything) to say about that.
      }

      const result = responder(promptText);

      if (typeof result === 'object' && result.error) {
        res.writeHead(result.status ?? 401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: { message: result.message ?? 'Invalid API key provided.', type: 'invalid_request_error', code: 'invalid_api_key' },
          }),
        );
        return;
      }

      const text = result;
      const id = `mock-${requests}`;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(sseChunk(id, { role: 'assistant', content: '' }, null));
      res.write(sseChunk(id, { content: text }, null));
      res.write(sseChunk(id, {}, 'stop'));
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/v1`,
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
