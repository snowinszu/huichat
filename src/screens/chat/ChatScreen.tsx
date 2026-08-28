import { useEffect, useRef, useState } from 'react';
import styles from './ChatScreen.module.css';
import {
  AnnotationNote,
  Button,
  ConfirmDialog,
  IconAlertCircle,
  IconArrowLeft,
  IconButton,
  IconImage,
  IconPlus,
  IconRefresh,
  IconStar,
  IconTrash,
  LockButton,
  MessageBubble,
  ReplyCard,
  ToneChip,
  TranslationNote,
  useToast,
} from '../../components/ui';
import { avatarGradient } from '../../lib/avatarGradient';
import { DEFAULT_APP_PREFERENCE } from '../../lib/appPreferenceDefaults';
import { isNonChineseText } from '../../../electron/shared/language';
import { NO_CURRENT_MODEL_CARD_MESSAGE } from '../../../electron/shared/errors';
import { SMART_TONE_ID, SMART_TONE_LABEL } from '../../../electron/shared/tone';
import type { AppPreferenceRecord, ChatCardRecord, MessageRecord, MessageRole, ReplyCandidate } from '../../../electron/shared/ipc-types';

export interface ChatScreenProps {
  chatCardId: number;
  onBack: () => void;
  onNavigateToModels: () => void;
}

const ANNOTATION_TYPES = ['表情', '图片', '其他'];
const TONE_OPTIONS = ['礼貌', '幽默', '暧昧', '真诚', '撒娇', '高冷', '简洁直接', '安慰共情'];

type GenerationState = 'idle' | 'loading' | 'error' | 'done';
type ReplySource = 'generate' | 'polish';
type DraftSender = Extract<MessageRole, 'other' | 'self'>;

const DRAFT_PLACEHOLDER: Record<DraftSender, string> = {
  other: '粘贴对方发来的消息…',
  self: '输入我主动发起的消息…',
};

function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

const DELETE_SUMMARY_MAX_LENGTH = 60;

// Confirm-delete summary needs its own text extraction since annotations
// carry their content in annotationText rather than content.
function messageDeletePreview(message: MessageRecord): string {
  const raw = message.role === 'annotation' ? (message.annotationText ?? '') : message.content;
  const trimmed = raw.trim();
  return trimmed.length > DELETE_SUMMARY_MAX_LENGTH ? `${trimmed.slice(0, DELETE_SUMMARY_MAX_LENGTH)}…` : trimmed;
}

export function ChatScreen({ chatCardId, onBack, onNavigateToModels }: ChatScreenProps) {
  const { showToast } = useToast();
  const [card, setCard] = useState<ChatCardRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [shortTermGoal, setShortTermGoal] = useState('');
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [draftSender, setDraftSender] = useState<DraftSender>('other');
  const [submitting, setSubmitting] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [annotationType, setAnnotationType] = useState(ANNOTATION_TYPES[0]);
  const [annotationText, setAnnotationText] = useState('');
  const [annotationSubmitting, setAnnotationSubmitting] = useState(false);
  const [selectedTone, setSelectedTone] = useState<string>(SMART_TONE_ID);
  const [customTones, setCustomTones] = useState<string[]>([]);
  const [addingCustomTone, setAddingCustomTone] = useState(false);
  const [customToneDraft, setCustomToneDraft] = useState('');
  const [genState, setGenState] = useState<GenerationState>('idle');
  const [genError, setGenError] = useState<string | null>(null);
  const [replySource, setReplySource] = useState<ReplySource>('generate');
  const [replies, setReplies] = useState<ReplyCandidate[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  const [polishDraft, setPolishDraft] = useState('');
  const [preference, setPreference] = useState<AppPreferenceRecord>(DEFAULT_APP_PREFERENCE);
  const [deleteTarget, setDeleteTarget] = useState<MessageRecord | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [revertTarget, setRevertTarget] = useState<MessageRecord | null>(null);
  const [revertingMessage, setRevertingMessage] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([window.api?.chatCard.get(chatCardId), window.api?.message.listByChatCard(chatCardId)])
      .then(([record, messageList]) => {
        if (cancelled) return;
        if (record) {
          setCard(record);
          setShortTermGoal(record.shortTermGoal);
        }
        if (messageList) setMessages(messageList);
      })
      .catch(() => {
        // No Electron bridge in this context — leave the card/messages unset.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chatCardId]);

  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight });
  }, [messages.length]);

  // Fetched fresh on every mount (not cached across screens) so a preference
  // changed on the Settings page takes effect the next time this screen opens.
  useEffect(() => {
    let cancelled = false;
    window.api?.appPreference
      .get()
      .then((record) => {
        if (!cancelled) setPreference(record);
      })
      .catch(() => {
        // No Electron bridge in this context — keep the in-memory defaults.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persisted on blur/Enter rather than per-keystroke so the field reads
  // naturally while typing but still takes effect immediately once you're
  // done — the next reply generation reads straight from the DB.
  async function saveShortTermGoal() {
    if (!card) return;
    const trimmed = shortTermGoal.trim();
    if (trimmed === card.shortTermGoal) {
      setShortTermGoal(trimmed);
      return;
    }
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      const updated = await window.api.chatCard.update(card.id, { shortTermGoal: trimmed });
      setCard(updated);
      setShortTermGoal(updated.shortTermGoal);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '短期目标保存失败', 'error');
    }
  }

  // Non-Chinese text gets machine-translated before the message lands in
  // the thread, unless the user has turned that off in Settings; a translate
  // failure still lets the original message through rather than blocking
  // the paste on a flaky LLM call. Only applies to the other party's side —
  // a message "我" typed in directly is already in whatever language "我"
  // wrote it in, so there's nothing to translate.
  async function handleAddMessage() {
    const trimmed = draftMessage.trim();
    if (!trimmed || !card) return;

    setSubmitting(true);
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');

      let translation: string | null = null;
      if (draftSender === 'other' && preference.translateNonChinese && isNonChineseText(trimmed)) {
        try {
          translation = await window.api.message.translate(trimmed);
        } catch (error) {
          showToast(error instanceof Error ? error.message : '翻译失败，已跳过翻译', 'error');
        }
      }

      const inserted = await window.api.message.insert({
        chatCardId: card.id,
        role: draftSender,
        content: trimmed,
        translation,
      });
      setMessages((current) => [...current, inserted]);
      setDraftMessage('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '添加消息失败', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // A standalone message row (role: 'annotation') rather than a text bubble,
  // so an emoji/image the other person sent can still be described and fed
  // into reply generation even though its actual pixels never get pasted in.
  async function handleAddAnnotation() {
    const trimmed = annotationText.trim();
    if (!trimmed || !card) return;

    setAnnotationSubmitting(true);
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      const inserted = await window.api.message.insert({
        chatCardId: card.id,
        role: 'annotation',
        annotationType,
        annotationText: trimmed,
      });
      setMessages((current) => [...current, inserted]);
      setAnnotationText('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '添加标注失败', 'error');
    } finally {
      setAnnotationSubmitting(false);
    }
  }

  // Deletion is a real DB delete (see message:delete), not a local hide — so
  // a failed request must leave the message in place rather than optimistically
  // removing it, and success removes it from state without a full re-fetch.
  async function handleConfirmDeleteMessage() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeletingMessage(true);
    try {
      if (!window.api) throw new Error('当前环境不支持删除（未连接到 Electron 主进程）');
      await window.api.message.delete(target.id);
      setMessages((current) => current.filter((message) => message.id !== target.id));
      setDeleteTarget(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '删除消息失败', 'error');
    } finally {
      setDeletingMessage(false);
    }
  }

  // Same real-DB-delete reasoning as handleConfirmDeleteMessage — the target
  // message is kept, everything after it is removed both in SQLite and in
  // local state, sliced by index rather than trusting the backend's returned
  // count to know which specific messages to drop from the array.
  async function handleConfirmRevertMessage() {
    if (!revertTarget) return;
    const target = revertTarget;
    setRevertingMessage(true);
    try {
      if (!window.api) throw new Error('当前环境不支持回退（未连接到 Electron 主进程）');
      const deletedCount = await window.api.message.revert(target.id);
      const targetIndex = messages.findIndex((message) => message.id === target.id);
      setMessages((current) => current.filter((_, index) => index <= targetIndex));
      setRevertTarget(null);
      showToast(`已回退，删除了 ${deletedCount} 条消息`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '回退失败', 'error');
    } finally {
      setRevertingMessage(false);
    }
  }

  // Lets a tone that isn't one of the 8 presets be typed in and used just
  // like them — added to the chip row and selected immediately. Session-only
  // (not persisted): there's no field for it in the schema, and re-typing an
  // occasional one-off tone is cheap.
  function commitCustomTone() {
    // A custom tone literally named "智能模式" would render as an
    // indistinguishable second chip but select a plain string instead of
    // SMART_TONE_ID — silently breaking the "自动判断语气" behavior. Reuse
    // the real smart-mode chip in that case instead of creating a duplicate.
    const trimmed = customToneDraft.trim();
    if (trimmed) {
      if (trimmed === SMART_TONE_LABEL) {
        setSelectedTone(SMART_TONE_ID);
      } else {
        if (!TONE_OPTIONS.includes(trimmed) && !customTones.includes(trimmed)) {
          setCustomTones((current) => [...current, trimmed]);
        }
        setSelectedTone(trimmed);
      }
    }
    setCustomToneDraft('');
    setAddingCustomTone(false);
  }

  // Clicking "生成回复" again after results are already showing just calls
  // this again — a fresh batch of candidates naturally replaces whatever's
  // on screen, so there's no separate "重新生成" action to maintain. Nothing
  // here is persisted; only a card the user explicitly copies or adds
  // becomes real state (clipboard or a `self` message).
  async function handleGenerate() {
    if (!card || !selectedTone) return;

    setGenState('loading');
    setGenError(null);
    setReplySource('generate');
    try {
      if (!window.api) throw new Error('当前环境不支持生成（未连接到 Electron 主进程）');
      const result = await window.api.reply.generate({ chatCardId: card.id, tone: selectedTone });
      setReplies(result);
      setGenState('done');
    } catch (error) {
      setGenError(error instanceof Error ? error.message : '生成失败，请检查 API 配置后重试');
      setGenState('error');
    }
  }

  // Polish shares the exact same result area (loading/error/cards) as
  // candidate generation — 3 tone-consistent rewordings of the draft land
  // in the same "候选回复" grid — rather than a separate result block, so
  // both flows read as one "语气驱动的候选回复" feature instead of two.
  async function runPolish(draft: string): Promise<boolean> {
    if (!card || !selectedTone) return false;

    setGenState('loading');
    setGenError(null);
    setReplySource('polish');
    try {
      if (!window.api) throw new Error('当前环境不支持润色（未连接到 Electron 主进程）');
      const result = await window.api.reply.polish({ chatCardId: card.id, tone: selectedTone, draft });
      setReplies(result);
      setGenState('done');
      return true;
    } catch (error) {
      setGenError(error instanceof Error ? error.message : '润色失败，请检查 API 配置后重试');
      setGenState('error');
      return false;
    }
  }

  // The draft is only cleared once the run actually succeeds — a failed
  // polish leaves it in the box so nothing typed gets lost, and a retry
  // right after still has the original text to work with.
  async function handlePolish() {
    const trimmed = polishDraft.trim();
    if (!trimmed || !card || !selectedTone) return;
    const success = await runPolish(trimmed);
    if (success) setPolishDraft('');
  }

  // "生成回复" is the single entry point for both flows — with something
  // typed in the "帮我润色" box it polishes that draft, otherwise it drafts
  // candidate replies from scratch — and doubles as the retry/regenerate
  // action: clicking it again re-reads whatever's currently in the box, so
  // a dedicated "重新生成" button would just be this same check twice over.
  function handleGenerateOrPolish() {
    if (polishDraft.trim()) void handlePolish();
    else void handleGenerate();
  }

  // When "生成时自动添加到历史" is on, "复制" does everything "加入对话"
  // already does (copy + insert into the thread) — same single write path,
  // so clicking either button afterward can never produce a duplicate
  // message. When it's off, this stays copy-only, matching today's behavior.
  async function handleCopyReply(index: number, candidate: ReplyCandidate) {
    if (preference.autoAddToHistory) {
      await handleAddReplyToThread(index, candidate);
      return;
    }
    try {
      await navigator.clipboard.writeText(candidate.text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 2000);
    } catch {
      showToast('复制失败，请手动选中文本复制', 'error');
    }
  }

  // Shared by every reply card — whether it came from "生成回复" or "润色",
  // adding it to the thread is the same write path handleAddMessage uses
  // for the other side, just with role: 'self'. The candidate's translation
  // (set when it was written to match a non-Chinese contact) rides along so
  // the thread keeps a Chinese record of what "我" actually said. It also
  // copies the text to the clipboard in the same click — this app doesn't
  // send messages anywhere itself, so "adding to the thread" only really
  // pays off once the text is also on the clipboard, ready to paste into
  // the real chat app.
  async function handleAddReplyToThread(index: number, candidate: ReplyCandidate) {
    if (!card) return;
    setAddingIndex(index);
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      const inserted = await window.api.message.insert({
        chatCardId: card.id,
        role: 'self',
        content: candidate.text,
        translation: candidate.translation,
      });
      setMessages((current) => [...current, inserted]);
      try {
        await navigator.clipboard.writeText(candidate.text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 2000);
        showToast('已加入对话并复制', 'success');
      } catch {
        showToast('已加入对话，但复制到剪贴板失败', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加入对话失败', 'error');
    } finally {
      setAddingIndex(null);
    }
  }

  if (loaded && !card) {
    return (
      <div>
        <header className={styles.topbar}>
          <IconButton aria-label="返回" onClick={onBack}>
            <IconArrowLeft size={20} />
          </IconButton>
          <span className={styles.name}>找不到该聊天对象</span>
        </header>
      </div>
    );
  }

  // Computed fresh each render from local state rather than trusting a
  // stale count captured at click time — messages only changes via this
  // component's own handlers, so this always reflects what's about to be
  // deleted for real.
  const revertIndex = revertTarget ? messages.findIndex((message) => message.id === revertTarget.id) : -1;
  const revertCount = revertIndex >= 0 ? messages.length - 1 - revertIndex : 0;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <IconButton aria-label="返回" onClick={onBack}>
          <IconArrowLeft size={20} />
        </IconButton>
        <div className={styles.avatar} style={card?.avatarPath ? undefined : { background: avatarGradient(card?.id ?? 0) }}>
          {card?.avatarPath ? <img className={styles.avatarImage} src={card.avatarPath} alt="" /> : card?.name.charAt(0)}
        </div>
        <div className={styles.info}>
          <div className={styles.name}>{card?.name}</div>
        </div>
        <div className={styles.goalTags}>
          <div className={styles.goalTag}>
            <span className={styles.goalTagLabel}>目标</span>
            <span className={styles.goalTagText}>{card?.longTermGoal || '未设定'}</span>
          </div>
          <div className={styles.goalTag}>
            <span className={styles.goalTagLabel}>今天</span>
            <input
              className={styles.goalTagInput}
              placeholder="设定本次短期目标…"
              value={shortTermGoal}
              onChange={(event) => setShortTermGoal(event.target.value)}
              onBlur={saveShortTermGoal}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  (event.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>
        </div>
        <LockButton />
      </header>

      <main className={styles.history} ref={historyRef}>
        {messages.length === 0 ? (
          <div className={styles.placeholder}>还没有消息，粘贴对方发来的第一条消息开始吧</div>
        ) : (
          messages.map((message, index) => {
            // Annotations are only ever created from the "对方消息" input
            // area (there's no self-side equivalent), so they always align
            // with the other person's messages, avatar included — otherwise
            // the dashed independent-bubble style reads as sender-less.
            const isAnnotation = message.role === 'annotation';
            const isSelf = message.role === 'self';
            const isLastMessage = index === messages.length - 1;
            return (
              <div key={message.id} className={[styles.msgRow, isSelf ? styles.me : styles.them].join(' ')}>
                {!isSelf && (
                  <div
                    className={styles.msgAvatar}
                    style={card?.avatarPath ? undefined : { background: avatarGradient(card?.id ?? 0) }}
                  >
                    {card?.avatarPath ? <img className={styles.avatarImage} src={card.avatarPath} alt="" /> : card?.name.charAt(0)}
                  </div>
                )}
                <div className={styles.msgContent}>
                  {isAnnotation ? (
                    <AnnotationNote type={message.annotationType ?? '标注'}>{message.annotationText}</AnnotationNote>
                  ) : (
                    <MessageBubble from={isSelf ? 'me' : 'them'}>{message.content}</MessageBubble>
                  )}
                  {message.translation && <TranslationNote>{message.translation}</TranslationNote>}
                  <span className={styles.msgTime}>{formatMessageTime(message.createdAt)}</span>
                </div>
                {!isLastMessage && (
                  <IconButton
                    className={styles.msgActionBtn}
                    size="sm"
                    variant="surface"
                    aria-label="回退"
                    onClick={() => setRevertTarget(message)}
                  >
                    <IconRefresh size={13} />
                  </IconButton>
                )}
                <IconButton
                  className={styles.msgActionBtn}
                  size="sm"
                  variant="surface"
                  danger
                  aria-label="删除消息"
                  onClick={() => setDeleteTarget(message)}
                >
                  <IconTrash size={13} />
                </IconButton>
              </div>
            );
          })
        )}
      </main>

      <div className={styles.bottomPanel}>
        <div className={styles.pasteGroup}>
          <div className={styles.inputRow}>
            <select
              className={styles.senderSelect}
              aria-label="发送方"
              value={draftSender}
              onChange={(event) => setDraftSender(event.target.value as DraftSender)}
            >
              <option value="other">对方</option>
              <option value="self">我</option>
            </select>
            <textarea
              className={styles.pasteInput}
              placeholder={DRAFT_PLACEHOLDER[draftSender]}
              rows={1}
              value={draftMessage}
              onChange={(event) => {
                setDraftMessage(event.target.value);
                const el = event.target;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void handleAddMessage();
                }
              }}
            />
            <Button size="sm" loading={submitting} disabled={!draftMessage.trim()} onClick={handleAddMessage}>
              添加消息
            </Button>
            <button type="button" className={styles.annotationToggle} onClick={() => setAnnotationOpen((current) => !current)}>
              <IconImage size={13} />
              图片 / 表情说明
            </button>
          </div>

          {annotationOpen && (
            <div className={styles.annotationExpand}>
              <select
                className={styles.annTypeSelect}
                value={annotationType}
                onChange={(event) => setAnnotationType(event.target.value)}
              >
                {ANNOTATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                className={styles.annMeaningInput}
                placeholder="描述内容的含义，比如：一只猫从被窝里探头，表达期待又困倦的状态…"
                value={annotationText}
                onChange={(event) => setAnnotationText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleAddAnnotation();
                  }
                }}
              />
              <Button size="sm" loading={annotationSubmitting} disabled={!annotationText.trim()} onClick={handleAddAnnotation}>
                添加
              </Button>
            </div>
          )}
        </div>

        <div className={styles.toneRow}>
          <span className={styles.toneLabel}>语气：</span>
          <ToneChip active={selectedTone === SMART_TONE_ID} onClick={() => setSelectedTone(SMART_TONE_ID)}>
            {SMART_TONE_LABEL}
          </ToneChip>
          {TONE_OPTIONS.map((tone) => (
            <ToneChip key={tone} active={selectedTone === tone} onClick={() => setSelectedTone(tone)}>
              {tone}
            </ToneChip>
          ))}
          {customTones.map((tone) => (
            <ToneChip key={tone} active={selectedTone === tone} onClick={() => setSelectedTone(tone)}>
              {tone}
            </ToneChip>
          ))}
          {addingCustomTone ? (
            <input
              autoFocus
              className={styles.customToneInput}
              placeholder="自定义语气"
              value={customToneDraft}
              onChange={(event) => setCustomToneDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitCustomTone();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setCustomToneDraft('');
                  setAddingCustomTone(false);
                }
              }}
              onBlur={commitCustomTone}
            />
          ) : (
            <button type="button" className={styles.addToneBtn} onClick={() => setAddingCustomTone(true)}>
              <IconPlus size={11} />
              自定义
            </button>
          )}
          <Button
            className={styles.genBtn}
            icon={<IconStar size={17} />}
            loading={genState === 'loading'}
            disabled={!selectedTone}
            onClick={handleGenerateOrPolish}
          >
            生成回复
          </Button>
        </div>

        <div className={styles.genRow}>
          <div className={styles.replyArea}>
            {genState === 'loading' && (
              <div className={styles.skeletonCards}>
                {[0, 1, 2].map((index) => (
                  <div key={index} className={styles.skeletonCard}>
                    <div className={styles.skelLine} style={{ width: '90%' }} />
                    <div className={styles.skelLine} style={{ width: '75%' }} />
                    <div className={styles.skelLine} style={{ width: '55%' }} />
                  </div>
                ))}
              </div>
            )}

            {genState === 'error' && (
              <div className={styles.errorCard}>
                <IconAlertCircle size={18} />
                <span className={styles.errorCardText}>{genError}</span>
                {genError?.includes(NO_CURRENT_MODEL_CARD_MESSAGE) ? (
                  <button type="button" className={styles.retryBtn} onClick={onNavigateToModels}>
                    去模型页
                  </button>
                ) : (
                  <button type="button" className={styles.retryBtn} onClick={handleGenerateOrPolish}>
                    重试
                  </button>
                )}
              </div>
            )}

            {genState === 'done' && replies.length > 0 && (
              <>
                <div className={styles.replyCardsHeader}>
                  <span className={styles.replyHeaderLabel}>
                    {replySource === 'polish' ? '润色结果' : '候选回复'} ·{' '}
                    {selectedTone === SMART_TONE_ID ? SMART_TONE_LABEL : `${selectedTone}语气`}
                  </span>
                </div>
                <div className={styles.replyCards} style={{ gridTemplateColumns: `repeat(${replies.length}, 1fr)` }}>
                  {replies.map((candidate, index) => (
                    <ReplyCard
                      key={index}
                      text={candidate.text}
                      translation={candidate.translation}
                      tag={`选项 ${index + 1}`}
                      copied={copiedIndex === index}
                      onCopy={() => handleCopyReply(index, candidate)}
                      adding={addingIndex === index}
                      onAdd={() => handleAddReplyToThread(index, candidate)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.polishRow}>
          <span className={styles.polishLabel}>帮我润色</span>
          <input
            type="text"
            className={styles.polishInput}
            placeholder="用自己的话说出想法，AI 帮你打磨成合适的表达"
            value={polishDraft}
            onChange={(event) => setPolishDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleGenerateOrPolish();
              }
            }}
          />
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        tone="danger"
        title="删除这条消息"
        confirmLabel="确认删除"
        confirmLoading={deletingMessage}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteMessage}
      >
        确定删除「{deleteTarget ? messageDeletePreview(deleteTarget) : ''}」吗？删除后无法恢复。
      </ConfirmDialog>

      <ConfirmDialog
        open={revertTarget !== null}
        tone="danger"
        title="回退到此消息"
        confirmLabel="确认回退"
        confirmLoading={revertingMessage}
        onClose={() => setRevertTarget(null)}
        onConfirm={handleConfirmRevertMessage}
      >
        将删除此消息之后的 {revertCount} 条消息，此操作无法撤销。确认回退吗？
      </ConfirmDialog>
    </div>
  );
}
