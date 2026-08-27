/**
 * Fewer than 20% Chinese characters counts as non-Chinese — same heuristic
 * as the `chat.html` design mock. Shared between the renderer (deciding
 * whether to translate a pasted message) and the main process (deciding
 * whether generated/polished replies should match the other party's
 * language), so the two never disagree about what counts as "Chinese".
 */
export function isNonChineseText(text: string): boolean {
  const chineseChars = (text.match(/[一-龥]/g) ?? []).length;
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 && chineseChars / totalChars < 0.2;
}
