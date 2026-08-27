import { useEffect, useState } from 'react';
import styles from './ModelsScreen.module.css';
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
  PasswordInput,
  Select,
  useToast,
} from '../../components/ui';
import { avatarGradient } from '../../lib/avatarGradient';
import type { LlmProviderId, ModelCardRecord } from '../../../electron/shared/ipc-types';
import { PROVIDER_META, PROVIDER_ORDER, maskApiKey, validateApiKey, validateBaseUrl, validateModel } from './providerMeta';

export interface ModelsScreenProps {
  onBack: () => void;
}

function validateName(value: string): string | undefined {
  return value.trim() ? undefined : '请填写卡片名称';
}

interface FieldErrors {
  name?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export function ModelsScreen({ onBack }: ModelsScreenProps) {
  const { showToast } = useToast();
  const [modelCards, setModelCards] = useState<ModelCardRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<LlmProviderId>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ModelCardRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);

  async function refresh() {
    if (!window.api) return;
    const list = await window.api.modelCard.list();
    setModelCards(list);
  }

  useEffect(() => {
    let cancelled = false;
    window.api?.modelCard
      .list()
      .then((list) => {
        if (!cancelled) setModelCards(list);
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
    setProvider('openai');
    setApiKey('');
    setModel(PROVIDER_META.openai.models[0] ?? '');
    setBaseUrl('');
    setErrors({});
  }

  function openEdit(card: ModelCardRecord) {
    setEditingId(card.id);
    setName(card.name);
    setProvider(card.provider);
    setApiKey(card.apiKey);
    setModel(card.model);
    setBaseUrl(card.baseUrl ?? '');
    setErrors({});
  }

  function closeEditModal() {
    setEditingId(null);
  }

  function handleProviderChange(next: LlmProviderId) {
    setProvider(next);
    setModel(PROVIDER_META[next].models[0] ?? '');
    if (next !== 'custom') setBaseUrl('');
    setErrors((current) => ({ ...current, apiKey: undefined, model: undefined, baseUrl: undefined }));
  }

  function validateAll(): FieldErrors {
    const next: FieldErrors = {
      name: validateName(name),
      apiKey: validateApiKey(apiKey),
      model: validateModel(model),
      baseUrl: validateBaseUrl(provider, baseUrl),
    };
    setErrors(next);
    return next;
  }

  async function handleSave() {
    const fieldErrors = validateAll();
    if (fieldErrors.name || fieldErrors.apiKey || fieldErrors.model || fieldErrors.baseUrl) return;

    const payload = {
      name: name.trim(),
      provider,
      apiKey: apiKey.trim(),
      model: model.trim(),
      baseUrl: provider === 'custom' ? baseUrl.trim() : null,
    };

    setSaving(true);
    try {
      if (!window.api) throw new Error('当前环境不支持保存（未连接到 Electron 主进程）');
      if (editingId === 'new') {
        await window.api.modelCard.create(payload);
        showToast('模型卡片已创建', 'success');
      } else if (editingId !== null) {
        await window.api.modelCard.update(editingId, payload);
        showToast('模型卡片已保存', 'success');
      }
      await refresh();
      closeEditModal();
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
      await window.api.modelCard.delete(deleteTarget.id);
      showToast('模型卡片已删除', 'success');
      await refresh();
      setDeleteTarget(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '删除失败', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSetCurrent(card: ModelCardRecord) {
    setSwitchingId(card.id);
    try {
      if (!window.api) throw new Error('当前环境不支持切换（未连接到 Electron 主进程）');
      await window.api.modelCard.setCurrent(card.id);
      showToast(`已切换当前模型为「${card.name}」`, 'success');
      await refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '切换失败', 'error');
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleTestConnection(card: ModelCardRecord) {
    setTestingId(card.id);
    try {
      if (!window.api) throw new Error('当前环境不支持测试连接（未连接到 Electron 主进程）');
      await window.api.llm.testConnection({
        provider: card.provider,
        apiKey: card.apiKey,
        model: card.model,
        baseUrl: card.baseUrl ?? undefined,
      });
      showToast(`「${card.name}」连接测试成功 ✓`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? `连接测试失败：${error.message}` : '连接测试失败', 'error');
    } finally {
      setTestingId(null);
    }
  }

  const meta = PROVIDER_META[provider];

  return (
    <div>
      <header className={styles.titlebar}>
        <IconButton aria-label="返回" onClick={onBack}>
          <IconArrowLeft size={20} />
        </IconButton>
        <span className={styles.pageTitle}>模型卡片</span>
        <Button size="sm" icon={<IconPlus size={14} />} onClick={openCreate}>
          新建模型卡片
        </Button>
      </header>

      <main className={styles.main}>
        <p className={styles.intro}>
          每张模型卡片保存一份独立的 AI 服务配置（提供方 / API Key / 模型），可以创建多张互不覆盖。选择其中一张作为"当前模型"，生成回复、翻译等所有
          AI 功能都会使用它。
        </p>

        {loaded && modelCards.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="M9 9h6v6H9z" />
                <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
              </svg>
            </div>
            <div className={styles.emptyTitle}>还没有模型卡片</div>
            <div className={styles.emptySub}>创建一张模型卡片，配置好 AI 服务，即可开始生成回复、翻译等功能。</div>
            <Button size="sm" icon={<IconPlus size={14} />} onClick={openCreate}>
              新建第一张模型卡片
            </Button>
          </div>
        ) : (
          <div className={styles.list}>
            {modelCards.map((card) => (
              <div key={card.id} className={styles.item}>
                <div className={styles.avatar} style={{ background: avatarGradient(card.id) }}>
                  {card.name.charAt(0)}
                </div>
                <div className={styles.body}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>{card.name}</span>
                    {card.isCurrent && <span className={styles.currentBadge}>当前模型</span>}
                  </div>
                  <div className={styles.info}>
                    {PROVIDER_META[card.provider].label} · {card.model}
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.keyPreview}>{maskApiKey(card.apiKey)}</span>
                  </div>
                </div>
                <div className={styles.actions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={testingId === card.id}
                    disabled={switchingId !== null && switchingId !== card.id}
                    onClick={() => handleTestConnection(card)}
                  >
                    测试连接
                  </Button>
                  {!card.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={switchingId === card.id}
                      disabled={testingId !== null && testingId !== card.id}
                      onClick={() => handleSetCurrent(card)}
                    >
                      设为当前模型
                    </Button>
                  )}
                  <IconButton aria-label={`编辑${card.name}`} onClick={() => openEdit(card)}>
                    <IconEdit size={16} />
                  </IconButton>
                  {!card.isCurrent && (
                    <IconButton aria-label={`删除${card.name}`} danger onClick={() => setDeleteTarget(card)}>
                      <IconTrash size={16} />
                    </IconButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.versionInfo}>会聊 v0.1.0 · Phase 1 · 仅本地运行，不连接社交账号</div>
      </main>

      <Modal
        open={editingId !== null}
        onClose={closeEditModal}
        title={editingId === 'new' ? '新建模型卡片' : `编辑模型卡片 · ${name}`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeEditModal}>
              取消
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave}>
              保存卡片
            </Button>
          </>
        }
      >
        <div className={styles.fields}>
          <Input
            label="卡片名称"
            required
            placeholder="例如：OpenAI-工作号、Anthropic-个人号"
            value={name}
            error={errors.name}
            onChange={(event) => {
              setName(event.target.value);
              if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
            }}
          />

          <Select label="AI 提供方" value={provider} onChange={(event) => handleProviderChange(event.target.value as LlmProviderId)}>
            {PROVIDER_ORDER.map((id) => (
              <option key={id} value={id}>
                {PROVIDER_META[id].label}
              </option>
            ))}
          </Select>

          {provider === 'custom' && (
            <Input
              label="API Endpoint"
              hint="自定义兼容 OpenAI 格式的基础 URL"
              type="url"
              placeholder="https://your-endpoint.com/v1"
              value={baseUrl}
              error={errors.baseUrl}
              onChange={(event) => {
                setBaseUrl(event.target.value);
                if (errors.baseUrl) setErrors((current) => ({ ...current, baseUrl: undefined }));
              }}
            />
          )}

          <PasswordInput
            label="API Key"
            hint="仅保存在本地，不会上传"
            value={apiKey}
            placeholder={meta.keyPlaceholder}
            error={errors.apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              if (errors.apiKey) setErrors((current) => ({ ...current, apiKey: undefined }));
            }}
          />

          <div>
            <Input
              label="模型名称"
              value={model}
              placeholder={meta.models[0] ?? '模型名称'}
              error={errors.model}
              onChange={(event) => {
                setModel(event.target.value);
                if (errors.model) setErrors((current) => ({ ...current, model: undefined }));
              }}
            />
            {meta.models.length > 0 && (
              <div className={styles.modelSuggestions}>
                {meta.models.map((suggestion) => (
                  <button key={suggestion} type="button" className={styles.modelChip} onClick={() => setModel(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {deleteTarget && (
        <ConfirmDialog
          open
          tone="danger"
          title="删除模型卡片"
          confirmLabel="确认删除"
          confirmLoading={deleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        >
          确认删除模型卡片「{deleteTarget.name}」？此操作无法撤销。
        </ConfirmDialog>
      )}
    </div>
  );
}
