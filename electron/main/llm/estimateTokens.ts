// Matches CJK ideographs/kana/hangul — text in this app is a Chinese/
// Japanese/English mix, and those three scripts tokenize very differently
// under a real tokenizer (roughly 1 token per CJK character vs. ~4 Latin
// characters per token). Counting the two groups separately gives a much
// less wrong estimate than treating every character the same.
const CJK_CHAR = /[一-鿿぀-ヿ゠-ヿ가-힯]/;

/**
 * Heuristic token count, no tokenizer dependency: CJK characters count as
 * ~1 token each, everything else as ~1/4 token (character) each. Not meant
 * to match any real provider's tokenizer exactly — only to be monotonic and
 * stable enough to compare against a threshold (see maybeSummarizeHistory).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;

  let cjkChars = 0;
  let otherChars = 0;
  for (const char of text) {
    if (CJK_CHAR.test(char)) cjkChars++;
    else otherChars++;
  }

  return Math.ceil(cjkChars + otherChars / 4);
}
