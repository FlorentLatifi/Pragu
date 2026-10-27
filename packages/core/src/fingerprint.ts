import type { PamNode } from './model.js';

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** 64-bit FNV-1a over the UTF-8 bytes of `input`, as 16 hex characters. Fast, stable, not cryptographic. */
export function fnv1a64(input: string): string {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * Walking-skeleton fingerprint: a developer-assigned id when there is one,
 * otherwise role + name + text. ADR-004 describes the robust version that
 * baselines will need (survives layout shifts and copy edits).
 */
export function issueFingerprint(ruleId: string, appId: string, screenName: string, node: PamNode): string {
  const nodeKey =
    node.resourceId !== null
      ? `id:${node.resourceId}`
      : `role:${node.role}|name:${node.name ?? ''}|text:${node.text ?? ''}`;
  return fnv1a64([ruleId, appId, screenName, nodeKey].join('\u0000'));
}
