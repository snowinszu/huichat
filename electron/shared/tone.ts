/**
 * Sentinel value for the "智能模式" tone option, shared verbatim between
 * renderer (tone selector) and main (prompt building for generate/polish)
 * so both sides agree on what marks "let the AI infer the tone" versus a
 * literal tone string. Deliberately not a human-readable word — a user
 * typing "智能模式" into the custom-tone box must not collide with this and
 * silently start behaving like smart mode.
 */
export const SMART_TONE_ID = '__smart__';

export const SMART_TONE_LABEL = '智能模式';
