import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/** Passed alongside every `callLlm` call so it knows whether/where to export this interaction, and how to label it. */
export interface DebugExportContext {
  /** Human-readable trigger, e.g. '生成回复' — becomes part of the filename and appears in the file body. */
  source: string;
  enabled: boolean;
  dir: string | null;
}

interface DebugExportPayload {
  provider: string;
  model: string;
  prompt: string;
  response?: string;
  error?: string;
  timestamp: Date;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function timestampForFilename(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// Source labels are short hand-written Chinese/English strings (see callers)
// rather than user input, but sanitizing anyway keeps the filename safe
// regardless of what a future call site passes.
function sanitizeForFilename(source: string): string {
  return source.replace(/[^a-zA-Z0-9一-鿿-]+/g, '-');
}

function buildFileContent(context: DebugExportContext, payload: DebugExportPayload): string {
  return [
    `时间: ${payload.timestamp.toLocaleString('zh-CN')}`,
    `来源: ${context.source}`,
    `Provider: ${payload.provider}`,
    `Model: ${payload.model}`,
    '',
    '【Prompt】',
    payload.prompt,
    '',
    payload.error ? '【错误】' : '【Response】',
    payload.error ?? payload.response ?? '',
    '',
  ].join('\n');
}

/**
 * Fire-and-forget: writes one file per LLM interaction when the user has
 * opted into debug export via Settings. Never throws and is never awaited by
 * callers — a write failure (directory deleted, no permission) must not
 * surface as a failure on the actual LLM call it's piggybacking on, and must
 * not delay returning that call's result to the user.
 */
export function exportDebugInteraction(context: DebugExportContext | undefined, payload: DebugExportPayload): void {
  if (!context?.enabled || !context.dir) return;

  const filename = `${timestampForFilename(payload.timestamp)}-${randomBytes(3).toString('hex')}_${sanitizeForFilename(context.source)}.txt`;
  const filePath = path.join(context.dir, filename);
  const content = buildFileContent(context, payload);

  fs.writeFile(filePath, content, 'utf8').catch((error: unknown) => {
    console.error('[debug-export] failed to write LLM interaction file', error);
  });
}
