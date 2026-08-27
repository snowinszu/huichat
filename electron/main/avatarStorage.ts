import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app, nativeImage, protocol } from 'electron';

const AVATAR_PROTOCOL = 'avatar';
const THUMBNAIL_SIZE = 160;

function avatarsDir(): string {
  const dir = path.join(app.getPath('userData'), 'avatars');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Resizes the uploaded image down to a fixed-size thumbnail and writes it as
 * a PNG under Electron's per-OS userData directory, returning an
 * `avatar://<filename>` URL the renderer can put straight into an `<img
 * src>` (served by the custom protocol registered in main/index.ts).
 * Always re-encoding to PNG sidesteps having to detect/trust the upload's
 * original format or extension.
 */
export function saveAvatar(data: Buffer): string {
  const thumbnail = nativeImage.createFromBuffer(data).resize({
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    quality: 'good',
  });
  const filename = `${crypto.randomUUID()}.png`;
  fs.writeFileSync(path.join(avatarsDir(), filename), thumbnail.toPNG());
  return `${AVATAR_PROTOCOL}://${filename}`;
}

/** No-ops for anything that isn't one of our own avatar:// URLs (e.g. null, or a future non-local source). */
export function deleteAvatarIfLocal(avatarUrl: string | null | undefined): void {
  if (!avatarUrl?.startsWith(`${AVATAR_PROTOCOL}://`)) return;
  const filename = avatarUrl.slice(`${AVATAR_PROTOCOL}://`.length);
  fs.rm(path.join(avatarsDir(), filename), { force: true }, () => {
    // Best-effort cleanup — a leftover thumbnail file costs a few KB and isn't worth failing the caller over.
  });
}

export function registerAvatarProtocol(): void {
  protocol.handle(AVATAR_PROTOCOL, async (request) => {
    const filename = request.url.slice(`${AVATAR_PROTOCOL}://`.length);
    try {
      const data = await fs.promises.readFile(path.join(avatarsDir(), filename));
      return new Response(data, { headers: { 'Content-Type': 'image/png' } });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}
