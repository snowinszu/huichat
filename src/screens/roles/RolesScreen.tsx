import { useEffect, useState } from 'react';
import styles from './RolesScreen.module.css';
import {
  Button,
  ConfirmDialog,
  IconArrowLeft,
  IconButton,
  IconEdit,
  IconPlus,
  IconTrash,
  Input,
  Modal,
  Textarea,
  useToast,
} from '../../components/ui';
import { avatarGradient } from '../../lib/avatarGradient';
import type { PersonaWithUsage } from '../../../electron/shared/ipc-types';

export interface RolesScreenProps {
  onBack: () => void;
}

function validateName(value: string): string | undefined {
  return value.trim() ? undefined : '请填写角色名称';
}

export function RolesScreen({ onBack }: RolesScreenProps) {
  const { showToast } = useToast();
  const [personas, setPersonas] = useState<PersonaWithUsage[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PersonaWithUsage | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh() {
    if (!window.api) return;
    const list = await window.api.persona.listWithUsage();
    setPersonas(list);
  }

  useEffect(() => {
    let cancelled = false;
    window.api?.persona
      .listWithUsage()
      .then((list) => {
        if (!cancelled) setPersonas(list);
      })
      .catch(() => {
        // No Electron bridge in this context — leave the list empty.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openCreate() {
    setEditingId('new');
    setName('');
    setBio('');
    setNameError(undefined);
  }

  function openEdit(persona: PersonaWithUsage) {
    setEditingId(persona.id);
    setName(persona.name);
    setBio(persona.bio);
    setNameError(undefined);
  }

  function closeEditModal() {
    setEditingId(null);
  }

  async function handleSave() {
    const error = validateName(name);
    setNameError(error);
    if (error) return;

    setSaving(true);
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      if (editingId === 'new') {
        await window.api.persona.create({ name: name.trim(), bio: bio.trim() });
        showToast('角色已创建', 'success');
      } else if (editingId !== null) {
        await window.api.persona.update(editingId, { name: name.trim(), bio: bio.trim() });
        showToast('角色已保存', 'success');
      }
      await refresh();
      closeEditModal();
    } catch (error_) {
      showToast(error_ instanceof Error ? error_.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (!window.api) throw new Error('当前环境不支持删除（未连接到 Electron 主进程）');
      await window.api.persona.delete(deleteTarget.id);
      showToast('角色已删除', 'success');
      await refresh();
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
        <IconButton aria-label="返回" onClick={onBack}>
          <IconArrowLeft size={20} />
        </IconButton>
        <span className={styles.pageTitle}>我的角色</span>
        <Button size="sm" icon={<IconPlus size={14} />} onClick={openCreate}>
          新建角色
        </Button>
      </header>

      <main className={styles.main}>
        <p className={styles.intro}>角色档案定义你在不同聊天场景下的身份和性格，选好后 AI 会以对应风格帮你回复。</p>

        {loaded && personas.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className={styles.emptyTitle}>还没有角色档案</div>
            <div className={styles.emptySub}>创建一个角色，定义你的身份和说话风格，后续创建聊天对象时可以选用。</div>
            <Button size="sm" icon={<IconPlus size={14} />} onClick={openCreate}>
              新建第一个角色
            </Button>
          </div>
        ) : (
          <div className={styles.list}>
            {personas.map((persona) => (
              <div key={persona.id} className={styles.item}>
                <div className={styles.avatar} style={{ background: avatarGradient(persona.id) }}>
                  {persona.name.charAt(0)}
                </div>
                <div className={styles.body}>
                  <div className={styles.name}>{persona.name}</div>
                  {persona.bio && <div className={styles.info}>{persona.bio}</div>}
                  <div className={styles.meta}>
                    <span className={[styles.usageBadge, persona.usageCount === 0 && styles.none].filter(Boolean).join(' ')}>
                      {persona.usageCount === 0 ? '暂未使用' : `被 ${persona.usageCount} 个聊天对象使用`}
                    </span>
                  </div>
                </div>
                <div className={styles.actions}>
                  <IconButton aria-label={`编辑${persona.name}`} onClick={() => openEdit(persona)}>
                    <IconEdit size={16} />
                  </IconButton>
                  <IconButton aria-label={`删除${persona.name}`} danger onClick={() => setDeleteTarget(persona)}>
                    <IconTrash size={16} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal
        open={editingId !== null}
        onClose={closeEditModal}
        title={editingId === 'new' ? '新建角色' : `编辑角色 · ${name}`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeEditModal}>
              取消
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave}>
              保存角色
            </Button>
          </>
        }
      >
        <Input
          label="角色名称"
          required
          placeholder="例如：真实的我、工作中的我、温柔的我"
          value={name}
          error={nameError}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(undefined);
          }}
        />
        <Textarea
          label="角色的基本信息"
          placeholder="描述这个角色的性格、说话风格、背景等，越详细 AI 越能准确模拟。例如：话不多但说到点上，不喜欢虚伪，幽默但不爱搞怪，有点慢热但对朋友很真诚"
          rows={4}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
      </Modal>

      {deleteTarget && deleteTarget.usageCount > 0 ? (
        <ConfirmDialog
          open
          tone="warning"
          title="该角色正在被使用"
          subtitle="删除前请注意以下影响"
          confirmLabel="确认删除"
          confirmLoading={deleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        >
          <div className={styles.warnBody}>
            角色 <strong>「{deleteTarget.name}」</strong>当前被<span className={styles.warnBadge}>{deleteTarget.usageCount}</span>
            个聊天对象引用。
            <br />
            <br />
            删除后，这些聊天对象将失去角色关联，AI 生成回复时将没有角色参考依据。建议先去编辑对应的聊天对象，更换角色后再删除。
            <br />
            <br />
            仍然要强制删除吗？
          </div>
        </ConfirmDialog>
      ) : (
        deleteTarget && (
          <ConfirmDialog
            open
            tone="danger"
            title="删除角色"
            confirmLabel="确认删除"
            confirmLoading={deleting}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleConfirmDelete}
          >
            确认删除角色「{deleteTarget.name}」？此操作无法撤销。
          </ConfirmDialog>
        )
      )}
    </div>
  );
}
