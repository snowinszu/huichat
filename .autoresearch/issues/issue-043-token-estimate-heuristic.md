# Token 数量启发式估算函数

## Description
新增一个不依赖第三方分词库、纯本地计算的 token 数量估算函数，用于判断"待摘要的老消息内容"是否已经多到需要触发摘要生成。

来源：`tasks/prd-chat-history-summary.md` — US-002

## Acceptance Criteria
- [x] 新增 `estimateTokenCount(text: string): number` 纯函数，基于字符数做启发式换算（不引入新的 npm 依赖）
- [x] 对中/日/英混合文本给出的估算值处于合理量级（不要求和真实 tokenizer 完全一致，只要求单调、稳定，能用于阈值比较）
- [x] 空字符串返回 0
- [x] Typecheck/lint 通过

## Verification Notes
新增 `electron/main/llm/estimateTokens.ts`：CJK 字符（中/日/韩表意文字、假名）按约 1 token/字计，其余字符（含英文、数字、标点）按约 0.25 token/字计后向上取整——比"一律按字符数算"更贴近真实 tokenizer 在中英文上的差异。用 `for...of` 按 Unicode 码点遍历而非 `.length`，emoji 等代理对字符不会被错误拆成两个字符计数。

直接验证：空字符串→0；纯中文 10 字→10；纯英文 40 字符（约9词）→10（对应"4字符≈1 token"的常见近似）；中日英混合、emoji 均不报错；更长文本的估算值单调不小于更短文本。

## Dependencies
None

## Type
backend

## Priority
low
