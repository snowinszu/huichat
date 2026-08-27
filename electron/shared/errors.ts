/**
 * Thrown by AI-calling IPC handlers (reply generate/polish, translate) when
 * no model card is marked current. Shared verbatim between main (where it's
 * thrown) and renderer (where the chat screen matches on it to offer a
 * "go to models page" action instead of a dead-end retry) so the two sides
 * can't drift apart on wording.
 */
export const NO_CURRENT_MODEL_CARD_MESSAGE = '请先在模型页创建并选择模型';
