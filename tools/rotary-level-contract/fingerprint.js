import { canonicalStringify } from './document.js';

export function getFingerprintPayload(document) {
  return {
    levelId: document.target.levelId,
    adapter: document.target.adapter,
    context: document.context
  };
}

export async function computeContextFingerprint(
  document,
  subtle = globalThis.crypto?.subtle
) {
  if (!subtle) throw new Error('Web Crypto subtle API is unavailable');
  const bytes = new TextEncoder().encode(
    canonicalStringify(getFingerprintPayload(document))
  );
  const digest = await subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}
