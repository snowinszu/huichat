import { useEffect, useMemo, useState } from 'react';
import styles from './HomeScreen.module.css';
import {
  AddContactCard,
  AvatarUpload,
  Button,
  ConfirmDialog,
  ContactCard,
  ContactCardGrid,
  IconButton,
  IconPlus,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '../../components/ui';
import { avatarGradient } from '../../lib/avatarGradient';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import type { ChatCardRecord, PersonaWithUsage } from '../../../electron/shared/ipc-types';

export interface HomeScreenProps {
  onNavigateToRoles: () => void;
  onNavigateToModels: () => void;
  onNavigateToSettings: () => void;
  onOpenChatCard: (id: number) => void;
  onOpenChatStats: (id: number) => void;
}

function validateRequired(value: string, message: string): string | undefined {
  return value.trim() ? undefined : message;
}

interface FieldErrors {
  name?: string;
  otherInfo?: string;
}

export function HomeScreen({
  onNavigateToRoles,
  onNavigateToModels,
  onNavigateToSettings,
  onOpenChatCard,
  onOpenChatStats,
}: HomeScreenProps) {
  const { showToast } = useToast();
  const [cards, setCards] = useState<ChatCardRecord[]>([]);
  const [personas, setPersonas] = useState<PersonaWithUsage[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [name, setName] = useState('');
  const [otherInfo, setOtherInfo] = useState('');
  const [longTermGoal, setLongTermGoal] = useState('');
  const [personaId, setPersonaId] = useState('');
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  // "+ 新建角色" used to navigate to a whole separate screen, which
  // unmounted HomeScreen and threw away everything already typed into this
  // form. Swapping the open modal's content in place instead keeps the
  // draft alive the whole time.
  const [modalMode, setModalMode] = useState<'card' | 'quick-role'>('card');
  const [quickRoleName, setQuickRoleName] = useState('');
  const [quickRoleBio, setQuickRoleBio] = useState('');
  const [quickRoleNameError, setQuickRoleNameError] = useState<string | undefined>();
  const [quickRoleSaving, setQuickRoleSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ChatCardRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const personaNameById = useMemo(() => new Map(personas.map((p) => [p.id, p.name])), [personas]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([window.api?.chatCard.list(), window.api?.persona.listWithUsage()])
      .then(([cardList, personaList]) => {
        if (cancelled) return;
        if (cardList) setCards(cardList);
        if (personaList) setPersonas(personaList);
      })
      .catch(() => {
        // No Electron bridge in this context — leave lists empty.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshCards() {
    if (!window.api) return;
    setCards(await window.api.chatCard.list());
  }

  function openCreate() {
    setEditingId('new');
    setName('');
    setOtherInfo('');
    setLongTermGoal('');
    setPersonaId('');
    setExistingAvatarUrl(null);
    setAvatarFile(null);
    setAvatarPreviewUrl(undefined);
    setErrors({});
  }

  function openEdit(card: ChatCardRecord) {
    setEditingId(card.id);
    setName(card.name);
    setOtherInfo(card.otherInfo);
    setLongTermGoal(card.longTermGoal);
    setPersonaId(card.personaId ? String(card.personaId) : '');
    setExistingAvatarUrl(card.avatarPath);
    setAvatarFile(null);
    setAvatarPreviewUrl(card.avatarPath ?? undefined);
    setErrors({});
  }

  function closeModal() {
    setEditingId(null);
    setModalMode('card');
  }

  function handleAvatarFileSelect(file: File) {
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  }

  function handleCreateNewRole() {
    setQuickRoleName('');
    setQuickRoleBio('');
    setQuickRoleNameError(undefined);
    setModalMode('quick-role');
  }

  function handleQuickRoleCancel() {
    setModalMode('card');
  }

  async function handleQuickRoleSave() {
    const trimmedName = quickRoleName.trim();
    if (!trimmedName) {
      setQuickRoleNameError('请填写角色名称');
      return;
    }
    setQuickRoleSaving(true);
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      const created = await window.api.persona.create({ name: trimmedName, bio: quickRoleBio.trim() });
      // The functional updater form is called twice in a row by React 19's
      // StrictMode in dev (by design, to surface non-idempotent updaters) —
      // guarding against re-adding the same id keeps a plain append safe
      // under that double-invocation instead of landing the persona twice.
      setPersonas((current) => (current.some((p) => p.id === created.id) ? current : [...current, { ...created, usageCount: 0 }]));
      setPersonaId(String(created.id));
      showToast('角色已创建', 'success');
      setModalMode('card');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '创建失败', 'error');
    } finally {
      setQuickRoleSaving(false);
    }
  }

  async function handleSave() {
    const nextErrors: FieldErrors = {
      name: validateRequired(name, '请填写对方称呼'),
      otherInfo: validateRequired(otherInfo, '请填写对方的基本信息'),
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.otherInfo) return;

    setSaving(true);
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');

      let newAvatarPath: string | undefined;
      if (avatarFile) {
        const bytes = new Uint8Array(await avatarFile.arrayBuffer());
        newAvatarPath = await window.api.avatar.save(bytes);
      }

      const parsedPersonaId = personaId ? Number(personaId) : null;

      if (editingId === 'new') {
        await window.api.chatCard.create({
          name: name.trim(),
          otherInfo: otherInfo.trim(),
          longTermGoal: longTermGoal.trim(),
          personaId: parsedPersonaId,
          avatarPath: newAvatarPath ?? null,
        });
        showToast('聊天对象已创建', 'success');
      } else if (editingId !== null) {
        await window.api.chatCard.update(editingId, {
          name: name.trim(),
          otherInfo: otherInfo.trim(),
          longTermGoal: longTermGoal.trim(),
          personaId: parsedPersonaId,
          ...(newAvatarPath ? { avatarPath: newAvatarPath } : {}),
        });
        showToast('聊天对象已保存', 'success');
      }
      await refreshCards();
      closeModal();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (!window.api) throw new Error('当前环境不支持删除（未连接到 Electron 主进程）');
      await window.api.chatCard.delete(deleteTarget.id);
      showToast('聊天对象已删除', 'success');
      await refreshCards();
      setDeleteTarget(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '删除失败', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <header className={styles.titlebar}>
        <div className={styles.logo}>
          <svg className={styles.icon} width="32" height="32" viewBox="0 0 240 240" aria-hidden="true">
            <defs>
              <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8E6CF0" />
                <stop offset="100%" stopColor="#5B3FD6" />
              </linearGradient>
            </defs>
            <rect width="240" height="240" rx="54" ry="54" fill="url(#logo-gradient)" />
            <path d="M58 130 L120 68" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" />
            <circle cx="58" cy="130" r="6" fill="#FFFFFF" />
            <path
              d="M130 36 Q133.96 54.04 152 58 Q133.96 61.96 130 80 Q126.04 61.96 108 58 Q126.04 54.04 130 36 Z"
              fill="#FFFFFF"
            />
            <path
              d="M160 70 Q161.44 76.56 168 78 Q161.44 79.44 160 86 Q158.56 79.44 152 78 Q158.56 76.56 160 70 Z"
              fill="#FFFFFF"
              opacity="0.7"
            />
            <path
              d="M150 40 Q151.08 44.92 156 46 Q151.08 47.08 150 52 Q148.92 47.08 144 46 Q148.92 44.92 150 40 Z"
              fill="#FFFFFF"
              opacity="0.6"
            />
            <rect x="112" y="122" width="70" height="10" rx="5" fill="#FFFFFF" />
            <rect x="112" y="142" width="52" height="10" rx="5" fill="#FFFFFF" opacity="0.72" />
            <rect x="112" y="162" width="60" height="10" rx="5" fill="#FFFFFF" opacity="0.46" />
          </svg>
          <span className={styles.name}>会聊</span>
        </div>
        <div className={styles.actions}>
          <IconButton aria-label="我的角色" onClick={onNavigateToRoles}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </IconButton>
          <IconButton aria-label="模型" onClick={onNavigateToModels}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <rect x="4" y="4" width="16" height="16" rx="3" />
              <path d="M9 9h6v6H9z" />
              <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
            </svg>
          </IconButton>
          <IconButton aria-label="设置" onClick={onNavigateToSettings}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </IconButton>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionTitle}>聊天对象</span>
            {cards.length > 0 && <span className={styles.sectionCount}>{cards.length} 位</span>}
          </div>
        </div>

        {loaded && cards.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className={styles.emptyTitle}>还没有聊天对象</div>
            <div className={styles.emptySub}>新建一个聊天对象卡片，录入对方的基本信息和你们的聊天目标，AI 就能帮你生成更贴心的回复了。</div>
            <Button icon={<IconPlus size={16} />} onClick={openCreate}>
              新建第一个聊天对象
            </Button>
          </div>
        ) : (
          <ContactCardGrid>
            {cards.map((card) => (
              <ContactCard
                key={card.id}
                name={card.name}
                avatarLabel={card.name.charAt(0)}
                avatarGradient={avatarGradient(card.id)}
                avatarUrl={card.avatarPath}
                preview={card.otherInfo || '暂无基本信息'}
                roleTag={card.personaId ? personaNameById.get(card.personaId) : undefined}
                time={formatRelativeTime(card.updatedAt)}
                onOpen={() => onOpenChatCard(card.id)}
                onOpenStats={() => onOpenChatStats(card.id)}
                onEdit={() => openEdit(card)}
                onDelete={() => setDeleteTarget(card)}
              />
            ))}
            <AddContactCard label="新建聊天对象" onClick={openCreate} />
          </ContactCardGrid>
        )}
      </main>

      <Modal
        open={editingId !== null}
        onClose={closeModal}
        title={modalMode === 'quick-role' ? '新建角色' : editingId === 'new' ? '新建聊天对象' : `编辑 · ${name}`}
        footer={
          modalMode === 'quick-role' ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleQuickRoleCancel}>
                取消
              </Button>
              <Button size="sm" loading={quickRoleSaving} onClick={handleQuickRoleSave}>
                保存角色
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                取消
              </Button>
              <Button size="sm" loading={saving} onClick={handleSave}>
                保存
              </Button>
            </>
          )
        }
      >
        {modalMode === 'quick-role' ? (
          <>
            <Input
              label="角色名称"
              required
              placeholder="例如：真实的我、工作中的我、温柔的我"
              value={quickRoleName}
              error={quickRoleNameError}
              onChange={(event) => {
                setQuickRoleName(event.target.value);
                if (quickRoleNameError) setQuickRoleNameError(undefined);
              }}
            />
            <Textarea
              label="角色的基本信息"
              placeholder="描述这个角色的性格、说话风格、背景等，越详细 AI 越能准确模拟。"
              rows={4}
              value={quickRoleBio}
              onChange={(event) => setQuickRoleBio(event.target.value)}
            />
          </>
        ) : (
          <>
            <AvatarUpload imageUrl={avatarPreviewUrl ?? existingAvatarUrl ?? undefined} onFileSelect={handleAvatarFileSelect} />

            <Input
              label="对方称呼"
              required
              placeholder="例如：小雅、阿远"
              value={name}
              error={errors.name}
              onChange={(event) => {
                setName(event.target.value);
                if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
              }}
            />

            <Textarea
              label="对方基本信息"
              required
              placeholder="例如：25岁，设计师，养了一只橘猫，喜欢露营和精酿啤酒，性格温柔但有时拿不定主意"
              rows={3}
              value={otherInfo}
              error={errors.otherInfo}
              onChange={(event) => {
                setOtherInfo(event.target.value);
                if (errors.otherInfo) setErrors((current) => ({ ...current, otherInfo: undefined }));
              }}
            />

            <Textarea
              label="聊天最终目标"
              placeholder="例如：希望发展成恋爱关系；或者：修复已经有些疏远的友情，重新建立亲密感"
              rows={2}
              value={longTermGoal}
              onChange={(event) => setLongTermGoal(event.target.value)}
            />

            <div>
              <div className={styles.selectRow}>
                <Select label="以哪个角色聊天" value={personaId} onChange={(event) => setPersonaId(event.target.value)}>
                  <option value="">选择己方角色档案…</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name}
                    </option>
                  ))}
                </Select>
                <button type="button" className={styles.newRoleBtn} onClick={handleCreateNewRole}>
                  + 新建角色
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        tone="danger"
        title="删除聊天对象"
        confirmLabel="确认删除"
        confirmLoading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      >
        确认删除「{deleteTarget?.name}」吗？该聊天对象的所有历史记录将一并删除，此操作无法撤销。
      </ConfirmDialog>
    </div>
  );
}
