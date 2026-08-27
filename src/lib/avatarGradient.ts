/**
 * Deterministic avatar gradient for entities that don't have an uploaded
 * image (personas, and chat cards before Issue #6 adds avatar upload).
 * Hashing the id (rather than random) means the same persona always gets
 * the same colors across renders/reloads. Hue spread + fixed
 * lightness/chroma keeps every gradient in the same visual family as the
 * design's hand-picked examples (violet/blue/teal/amber, ~55-70% L).
 */
export function avatarGradient(seed: number): string {
  const hue = ((seed * 47) % 360 + 360) % 360;
  const hue2 = (hue + 40) % 360;
  return `linear-gradient(135deg, oklch(68% 0.18 ${hue}), oklch(55% 0.2 ${hue2}))`;
}
