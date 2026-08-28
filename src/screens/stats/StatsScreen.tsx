import { useEffect, useState } from 'react';
import styles from './StatsScreen.module.css';
import { IconAlertCircle, IconArrowLeft, IconButton, LockButton } from '../../components/ui';
import { avatarGradient } from '../../lib/avatarGradient';
import { NO_CURRENT_MODEL_CARD_MESSAGE } from '../../../electron/shared/errors';
import type { ChatCardRecord, ChatStatsRecord, GoalEvaluationResult } from '../../../electron/shared/ipc-types';

export interface StatsScreenProps {
  chatCardId: number;
  onBack: () => void;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => String(hour));
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const VERDICT_CLASS_KEY: Record<GoalEvaluationResult['verdict'], 'verdictAchieved' | 'verdictPartial' | 'verdictNotAchieved'> = {
  已达成: 'verdictAchieved',
  部分达成: 'verdictPartial',
  未达成: 'verdictNotAchieved',
};

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "3天5小时" style — coarsened to the two largest units so a multi-day gap doesn't get buried in minutes. */
function formatDuration(ms: number): string {
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (ms < minute) return '不到 1 分钟';

  const days = Math.floor(ms / day);
  const hours = Math.floor((ms % day) / hour);
  const minutes = Math.floor((ms % hour) / minute);

  if (days > 0) return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`;
  if (hours > 0) return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
  return `${minutes} 分钟`;
}

interface StatTileProps {
  label: string;
  value: string;
}

function StatTile({ label, value }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  );
}

interface BarChartProps {
  labels: string[];
  values: number[];
}

function BarChart({ labels, values }: BarChartProps) {
  const max = Math.max(1, ...values);
  return (
    <div className={styles.barChart}>
      {values.map((value, index) => (
        <div key={index} className={styles.barColumn}>
          <div className={styles.barTrack}>
            <div
              className={styles.bar}
              style={{ height: `${(value / max) * 100}%` }}
              title={`${labels[index]}: ${value} 条`}
            />
          </div>
          <span className={styles.barLabel}>{labels[index]}</span>
        </div>
      ))}
    </div>
  );
}

type LoadState = 'loading' | 'error' | 'done';
type GoalState = 'idle' | 'loading' | 'error' | 'done';

export function StatsScreen({ chatCardId, onBack }: StatsScreenProps) {
  const [card, setCard] = useState<ChatCardRecord | null>(null);
  const [stats, setStats] = useState<ChatStatsRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [goalState, setGoalState] = useState<GoalState>('idle');
  const [goalError, setGoalError] = useState<string | null>(null);
  const [goalResult, setGoalResult] = useState<GoalEvaluationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([window.api?.chatCard.get(chatCardId), window.api?.chatStats.get(chatCardId)])
      .then(([cardRecord, statsRecord]) => {
        if (cancelled) return;
        if (cardRecord) setCard(cardRecord);
        if (statsRecord) setStats(statsRecord);
        setLoadState('done');

        // Kicked off from here (not a separate effect keyed on `card`) so the
        // "start loading" transition happens inside this async callback
        // rather than synchronously in an effect body. It still runs
        // independently of the numbers/charts above once triggered — a slow
        // AI response never blocks them, since they're already rendered by
        // the time this call resolves or fails.
        const hasGoal = Boolean(cardRecord?.longTermGoal.trim() || cardRecord?.shortTermGoal.trim());
        if (!hasGoal) return;
        setGoalState('loading');
        window.api?.chatStats
          .evaluateGoal(chatCardId)
          .then((result) => {
            if (cancelled) return;
            setGoalResult(result);
            setGoalState('done');
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            setGoalError(error instanceof Error ? error.message : '目标达成情况评估失败');
            setGoalState('error');
          });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : '加载统计数据失败');
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [chatCardId]);

  const hasMessages = (stats?.selfMessageCount ?? 0) + (stats?.otherMessageCount ?? 0) > 0;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <IconButton aria-label="返回" onClick={onBack}>
          <IconArrowLeft size={20} />
        </IconButton>
        <div className={styles.avatar} style={card?.avatarPath ? undefined : { background: avatarGradient(card?.id ?? chatCardId) }}>
          {card?.avatarPath ? <img className={styles.avatarImage} src={card.avatarPath} alt="" /> : card?.name.charAt(0)}
        </div>
        <div className={styles.title}>{card ? `${card.name} · 聊天统计` : '聊天统计'}</div>
        <LockButton />
      </header>

      <main className={styles.main}>
        {loadState === 'loading' && <div className={styles.placeholder}>正在统计…</div>}

        {loadState === 'error' && (
          <div className={styles.errorBlock}>
            <IconAlertCircle size={18} />
            <span>{loadError}</span>
          </div>
        )}

        {loadState === 'done' && stats && !hasMessages && (
          <div className={styles.placeholder}>暂无聊天记录，还没有可统计的数据</div>
        )}

        {loadState === 'done' && stats && hasMessages && (
          <>
            <section className={styles.tileGrid}>
              <StatTile label="我发送的消息" value={String(stats.selfMessageCount)} />
              <StatTile label="对方发送的消息" value={String(stats.otherMessageCount)} />
              <StatTile label="活跃天数" value={`${stats.activeDays} 天`} />
              <StatTile label="首次聊天时间" value={stats.firstMessageAt ? formatDateTime(stats.firstMessageAt) : '—'} />
              <StatTile label="最后聊天时间" value={stats.lastMessageAt ? formatDateTime(stats.lastMessageAt) : '—'} />
              <StatTile label="最长连续聊天天数" value={`${stats.longestStreakDays} 天`} />
              <StatTile label="最长沉默时间" value={stats.longestSilenceMs !== null ? formatDuration(stats.longestSilenceMs) : '—'} />
              <StatTile label="平均每日消息数" value={String(stats.avgMessagesPerActiveDay)} />
              <StatTile label="我方主动发起" value={`${stats.selfInitiatedDays} 次`} />
              <StatTile label="对方主动发起" value={`${stats.otherInitiatedDays} 次`} />
            </section>

            <section className={styles.chartSection}>
              <h2 className={styles.sectionTitle}>24 小时消息分布</h2>
              <BarChart labels={HOUR_LABELS} values={stats.hourDistribution} />
            </section>

            <section className={styles.chartSection}>
              <h2 className={styles.sectionTitle}>星期分布</h2>
              <BarChart labels={WEEKDAY_LABELS} values={stats.weekdayDistribution} />
            </section>

            <section className={styles.goalSection}>
              <h2 className={styles.sectionTitle}>聊天目标达成情况</h2>
              <div className={styles.goalTexts}>
                <div className={styles.goalTextRow}>
                  <span className={styles.goalTextLabel}>最终目标</span>
                  <span className={styles.goalTextValue}>{card?.longTermGoal || '未设定'}</span>
                </div>
                <div className={styles.goalTextRow}>
                  <span className={styles.goalTextLabel}>短期目标</span>
                  <span className={styles.goalTextValue}>{card?.shortTermGoal || '未设定'}</span>
                </div>
              </div>

              {goalState === 'idle' && <div className={styles.goalPlaceholder}>未设置目标</div>}
              {goalState === 'loading' && <div className={styles.goalPlaceholder}>AI 正在评估达成情况…</div>}
              {goalState === 'error' && (
                <div className={styles.errorBlock}>
                  <IconAlertCircle size={18} />
                  <span>{goalError?.includes(NO_CURRENT_MODEL_CARD_MESSAGE) ? NO_CURRENT_MODEL_CARD_MESSAGE : goalError}</span>
                </div>
              )}
              {goalState === 'done' && goalResult && (
                <div className={styles.goalResult}>
                  <span className={[styles.goalBadge, styles[VERDICT_CLASS_KEY[goalResult.verdict]]].join(' ')}>
                    {goalResult.verdict}
                  </span>
                  <span className={styles.goalReason}>{goalResult.reason}</span>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
