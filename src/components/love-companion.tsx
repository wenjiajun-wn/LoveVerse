'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MarkdownPreview } from './memory-editor/markdown-preview';
import { PhotoPicker } from './memory-editor/photo-picker';
import { BookEditor } from './companion/book-editor';
import { CompanionQuiz } from './companion/quiz';
import { MemoryDetail } from './memories';
import { toMemoryView, type MemoryView } from '@/lib/memory/adapter';
import {
  BookHeart,
  CalendarHeart,
  Gift,
  LockKeyhole,
  Sparkles,
  Heart,
  Download,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/client-api';
import { useMemories } from './memory-provider';
import type { V4Book, V4Plan, V4Dashboard } from '@/lib/v4/model';

type Section = 'book' | 'dates' | 'surprise' | 'capsule' | 'today' | 'quiz';
const choices: Array<{ key: Section; label: string; icon: typeof Heart }> = [
  { key: 'book', label: 'AI 回忆录', icon: BookHeart },
  { key: 'dates', label: '纪念日提醒', icon: CalendarHeart },
  { key: 'surprise', label: '惊喜策划', icon: Gift },
  { key: 'capsule', label: '时光胶囊', icon: LockKeyhole },
  { key: 'today', label: '往年今日', icon: Heart },
  { key: 'quiz', label: '回忆猜谜', icon: Sparkles },
];

function download(title: string, content: string) {
  const file = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) + '.loveverse-export.md';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function LoveCompanion() {
  const { mode, records } = useMemories();
  const [section, setSection] = useState<Section>('book');
  const [dashboard, setDashboard] = useState<V4Dashboard | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [bookTitle, setBookTitle] = useState('我们的回忆录');
  const [selected, setSelected] = useState<string[]>([]);
  const [aiIntro, setAiIntro] = useState(false);
  const [editingBook, setEditingBook] = useState<V4Book | null>(null);
  const [editingPlan, setEditingPlan] = useState<V4Plan | null>(null);
  const [filters, setFilters] = useState({ from: '', to: '', place: '', tag: '' });
  const [capsulePhotos, setCapsulePhotos] = useState<{ id: string; alt: string }[]>([]);
  const [detail, setDetail] = useState<MemoryView | null>(null);
  const filtered = records.filter(
    (r) =>
      (!filters.from || r.date >= filters.from) &&
      (!filters.to || r.date <= filters.to) &&
      r.place.includes(filters.place) &&
      (!filters.tag || r.tags.includes(filters.tag)),
  );
  const refresh = useCallback(async () => {
    const data = await api<V4Dashboard>('/api/v4');
    setDashboard(data);
  }, []);
  useEffect(() => {
    if (mode !== 'private') return;
    let active = true;
    void refresh().catch((e) => {
      if (active) setError(e.message);
    });
    const onFocus = () => {
      if (active) void refresh().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [mode, refresh]);
  async function execute(input: object, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/api/v4', { method: 'POST', body: JSON.stringify(input) });
      await refresh();
      setNotice(success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (mode !== 'private')
    return (
      <section className="page-section v4-page">
        <h1>Love Companion · 只属于你们的下一章</h1>
        <p>
          这里包含私人回忆与惊喜草稿。请使用独立的私人部署并登录后体验，不在公开演示中加载真实内容。
        </p>
      </section>
    );
  return (
    <section id="love-companion" className="page-section v4-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LOVEVERSE · CHAPTER FOUR</span>
          <h1>让回忆，继续发光。</h1>
          <p>从往日的小小心动，到未来的专属惊喜。</p>
        </div>
      </div>
      <nav className="v4-tabs" aria-label="Love Companion 功能">
        {choices.map(({ key, label, icon: Icon }) => (
          <button
            type="button"
            key={key}
            className={section === key ? 'v4-active' : ''}
            aria-pressed={section === key}
            onClick={() => {
              setSection(key);
              setError('');
              setNotice('');
            }}
          >
            <Icon size={17} /> {label}
          </button>
        ))}
      </nav>
      {dashboard === null && !error && <p role="status">正在加载私人空间…</p>}
      {error && (
        <p role="alert" className="v4-message v4-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="v4-message">
          {notice}
        </p>
      )}
      {section === 'book' && (
        <div className="v4-grid">
          <form
            className="v4-card"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await execute(
                {
                  action: 'book.create',
                  title: bookTitle,
                  memoryIds: selected.filter((id) => filtered.some((r) => r.id === id)),
                  aiIntro,
                  filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
                },
                '回忆录已生成，请打开草稿继续编辑。',
              );
              if (ok) setSelected([]);
            }}
          >
            <h2>
              <BookHeart size={21} /> 把故事写成一本书
            </h2>
            <p>
              选择 1–12 条记忆，章节中的真实故事保留原文。AI
              可帮助排列叙事顺序和摘录原文，不新增经历。
            </p>
            <label>
              回忆录名称
              <input
                value={bookTitle}
                maxLength={120}
                onChange={(e) => setBookTitle(e.target.value)}
                required
              />
            </label>
            <div className="v4-fields">
              {(['from', 'to', 'place', 'tag'] as const).map((key) => (
                <label key={key}>
                  {{ from: '开始日期', to: '结束日期', place: '筛选地点', tag: '筛选标签' }[key]}
                  <input
                    type={key === 'from' || key === 'to' ? 'date' : 'text'}
                    value={filters[key]}
                    onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <div className="v4-select-list" role="group" aria-label="选择回忆">
              {filtered.map((r) => (
                <label key={r.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked
                          ? [...old, r.id].slice(0, 12)
                          : old.filter((id) => id !== r.id),
                      )
                    }
                  />
                  <span>
                    {r.date} · {r.title}
                  </span>
                </label>
              ))}
              {!records.length && <p>请先在「恋爱日记」中记录几段真实回忆。</p>}
            </div>
            <label className="v4-check">
              <input
                type="checkbox"
                checked={aiIntro}
                onChange={(e) => setAiIntro(e.target.checked)}
              />
              使用 DeepSeek 组织章节（需要双方已开启 V3 云端 AI）
            </label>
            <button className="primary" disabled={busy || !selected.length || !bookTitle.trim()}>
              生成回忆录
            </button>
          </form>
          <div className="v4-card">
            <h2>已保存的回忆录</h2>
            {!dashboard?.books.length && <p>还没有回忆录，你们的第一本书等待被写下。</p>}
            {dashboard?.books.map((book) => (
              <article key={book.id} className="v4-item">
                <div>
                  <strong>{book.title}</strong>
                  <small>{book.sources.length} 条原始回忆</small>
                </div>
                <button type="button" onClick={() => setEditingBook(book)}>
                  打开草稿
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
      {section === 'dates' && (
        <div className="v4-grid">
          <form
            className="v4-card"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              await execute(
                {
                  action: 'reminders.save',
                  enabled: data.get('enabled') === 'on',
                  timeZone: String(data.get('timeZone')),
                  daysBefore: [0, 1, 7, 30].filter((n) => data.get('day-' + n) === 'on'),
                },
                '提醒偏好已保存。服务端定时任务生成站内通知，不会发送外部消息。',
              );
            }}
            key={dashboard ? JSON.stringify(dashboard.reminders) : 'loading'}
          >
            <h2>
              <CalendarHeart size={21} /> 纪念日站内提醒
            </h2>
            <p>沿用私人纪念日；配置常在线主机任务后，即使未打开网站也会生成站内通知。</p>
            <label className="v4-check">
              <input type="checkbox" name="enabled" defaultChecked={dashboard?.reminders.enabled} />
              为我的账号开启站内提醒
            </label>
            <label>
              提醒时区
              <input
                name="timeZone"
                defaultValue={dashboard?.reminders.timeZone || 'Asia/Shanghai'}
                required
                maxLength={80}
              />
            </label>
            {[30, 7, 1, 0].map((day) => (
              <label className="v4-check" key={day}>
                <input
                  type="checkbox"
                  name={'day-' + day}
                  defaultChecked={dashboard?.reminders.daysBefore.includes(day as 0 | 1 | 7 | 30)}
                />
                {day === 0 ? '纪念日当天' : '提前 ' + day + ' 天'}
              </label>
            ))}
            <button className="primary" disabled={busy}>
              保存提醒偏好
            </button>
          </form>
          <div className="v4-card">
            <h2>通知中心</h2>
            <p>
              任务最近运行：
              {dashboard?.schedulerLastRun
                ? new Date(dashboard.schedulerLastRun).toLocaleString()
                : '尚未运行，请按部署说明配置定时任务'}
            </p>
            {dashboard?.notifications.map((n) => (
              <article className="v4-item" key={n.id}>
                <div>
                  <strong>{n.title}</strong>
                  <small>
                    {n.date} · {n.daysBefore === 0 ? '当天' : '提前 ' + n.daysBefore + ' 天'} ·{' '}
                    {n.read ? '已读' : '未读'}
                  </small>
                </div>
                {!n.read && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void execute({ action: 'notification.read', id: n.id }, '已标为已读')
                    }
                  >
                    标为已读
                  </button>
                )}
              </article>
            ))}
            <h3>近期纪念日</h3>
            {!dashboard?.upcoming.length && <p>当前没有到达设定提醒日期的纪念日。</p>}
            {dashboard?.upcoming.map((item) => (
              <article className="v4-item" key={item.id}>
                <span>{item.title}</span>
                <strong>{item.days === 0 ? '就是今天' : '还有 ' + item.days + ' 天'}</strong>
              </article>
            ))}
            <a className="v4-link" href="#dates">
              去管理纪念日
            </a>
          </div>
        </div>
      )}
      {section === 'surprise' && (
        <div className="v4-grid">
          <form
            className="v4-card"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              await execute(
                {
                  action: 'plan.create',
                  title: String(data.get('title')),
                  budget: Number(data.get('budget')),
                  availableMinutes: Number(data.get('availableMinutes')),
                  currency: String(data.get('currency')),
                  date: String(data.get('date')) || undefined,
                  place: String(data.get('place')),
                  wishes: String(data.get('wishes')),
                  memoryIds: data.get('memory') ? [String(data.get('memory'))] : [],
                  useAI: data.get('ai') === 'on',
                },
                '惊喜方案已保存为仅自己可见的草稿。',
              );
            }}
          >
            <h2>
              <Gift size={21} /> 为对方准备一场惊喜
            </h2>
            <label>
              方案标题
              <input name="title" maxLength={120} required placeholder="比如：一场小小的重逢" />
            </label>
            <div className="v4-fields">
              <label>
                预算
                <input
                  name="budget"
                  type="number"
                  defaultValue="500"
                  min="0"
                  max="1000000"
                  required
                />
              </label>
              <label>
                币种
                <select name="currency">
                  <option value="CNY">CNY</option>
                  <option value="USD">USD</option>
                  <option value="JPY">JPY</option>
                </select>
              </label>
            </div>
            <label>
              可用时间（分钟）
              <input
                type="number"
                name="availableMinutes"
                min="30"
                max="1440"
                defaultValue="180"
                required
              />
            </label>
            <label>
              日期
              <input type="date" name="date" />
            </label>
            <label>
              城市或地点
              <input name="place" maxLength={100} placeholder="可留空" />
            </label>
            <label>
              希望的惊喜
              <textarea
                name="wishes"
                maxLength={500}
                required
                rows={3}
                placeholder="比如：安静一点，与第一次爬山有关"
              />
            </label>
            <label>
              关联回忆（可选）
              <select name="memory">
                <option value="">不关联</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="v4-check">
              <input name="ai" type="checkbox" /> 让 DeepSeek 生成创意草稿（需要云端 AI 同意）
            </label>
            <button className="primary" disabled={busy}>
              生成私人惊喜方案
            </button>
          </form>
          <div className="v4-card">
            <h2>只对我可见的策划草稿</h2>
            {!dashboard?.plans.length && <p>还没有秘密策划。</p>}
            {dashboard?.plans.map((plan) => (
              <article className="v4-item" key={plan.id}>
                <div>
                  <strong>{plan.title}</strong>
                  <small>
                    {plan.budget} {plan.currency}
                  </small>
                </div>
                <button type="button" onClick={() => setEditingPlan(plan)}>
                  编辑
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
      {section === 'capsule' && (
        <div className="v4-grid">
          <form
            className="v4-card"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = new FormData(form);
              const ok = await execute(
                {
                  action: 'capsule.create',
                  title: String(data.get('title')),
                  content: String(data.get('content')),
                  unlockDate: String(data.get('unlockDate')),
                  photos: capsulePhotos,
                },
                '时光胶囊已封存。在约定日期前，两个人都无法通过网站查看内容。',
              );
              if (ok) {
                form.reset();
                setCapsulePhotos([]);
              }
            }}
          >
            <h2>
              <LockKeyhole size={21} /> 写给未来的我们
            </h2>
            <label>
              胶囊名称
              <input name="title" maxLength={120} required placeholder="一年后的我们" />
            </label>
            <label>
              解锁日期
              <input name="unlockDate" type="date" required />
            </label>
            <label>
              未来才能读的信
              <textarea name="content" maxLength={10000} rows={7} required />
            </label>
            <p>
              附件从已授权私人照片库复制到独立封存区，最多 8
              张。原图库照片本身仍属于双方共享资料；新上传至图库的照片也可被双方看到。
            </p>
            <PhotoPicker
              value={capsulePhotos}
              onChange={(photos) => setCapsulePhotos(photos.slice(0, 8))}
            />
            <button className="primary" disabled={busy}>
              封存时光胶囊
            </button>
          </form>
          <div className="v4-card">
            <h2>我们的时光胶囊</h2>
            {!dashboard?.capsules.length && <p>还没有时光胶囊。</p>}
            {dashboard?.capsules.map((capsule) => (
              <article className="v4-item v4-capsule" key={capsule.id}>
                <div>
                  <strong>{capsule.title}</strong>
                  <small>解锁日期：{capsule.unlockDate}</small>
                  <p>{capsule.unlocked ? capsule.content : '尚未解锁 · 内容已封存'}</p>
                  <div className="v4-photo-grid">
                    {capsule.unlocked &&
                      capsule.photos.map((p) => (
                        <img
                          key={p.id}
                          src={`/api/v4/capsules/${capsule.id}/photos/${p.id}`}
                          alt={p.alt}
                        />
                      ))}
                  </div>
                </div>
                {capsule.canDelete && (
                  <button
                    type="button"
                    aria-label={'删除 ' + capsule.title}
                    disabled={busy}
                    onClick={() => {
                      if (confirm('确定删除这个时光胶囊？删除无法撤销。'))
                        void execute(
                          {
                            action: 'capsule.delete',
                            id: capsule.id,
                            revision: capsule.revision,
                            confirmed: true,
                          },
                          '时光胶囊已删除。',
                        );
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      {section === 'today' && (
        <div className="v4-card">
          <h2>
            <Heart size={21} /> 往年今日
          </h2>
          <p>从已保存的真实回忆中寻找同一天发生的故事，不补造过去。</p>
          {!dashboard?.todayMemories.length && <p>今天还没有对应的往年回忆。</p>}
          {dashboard?.todayMemories.map((item) => (
            <article className="v4-item" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.date} · {item.place}
                </small>
              </div>
              <div className="v4-actions">
                {records
                  .find((r) => r.id === item.id)
                  ?.photos.slice(0, 1)
                  .map((p) => (
                    <img width={100} key={p.id} src={'/api/uploads/' + p.id} alt={p.alt} />
                  ))}
                <button
                  onClick={() => {
                    const r = records.find((r) => r.id === item.id);
                    if (r) setDetail(toMemoryView(r));
                  }}
                >
                  查看原始回忆
                </button>
                <button
                  onClick={() => {
                    const r = records.find((r) => r.id === item.id);
                    if (
                      r &&
                      confirm(
                        '导出会包含私人日期、地点和正文。请确认双方同意后再分享；网站不会自动发送。',
                      )
                    )
                      download(r.title, `${r.date} · ${r.place}\n\n${r.story}`);
                  }}
                >
                  确认后导出分享
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {section === 'quiz' && <CompanionQuiz events={dashboard?.quiz ?? []} />}
      {detail && <MemoryDetail memory={detail} onClose={() => setDetail(null)} />}
      {editingBook && (
        <BookEditor item={editingBook} onClose={() => setEditingBook(null)} onSaved={refresh} />
      )}
      {editingPlan && (
        <DraftEditor
          title="秘密惊喜草稿"
          item={editingPlan}
          busy={busy}
          error={error}
          onClose={() => setEditingPlan(null)}
          onSave={async (_title, content) => {
            const success = await execute(
              {
                action: 'plan.update',
                id: editingPlan.id,
                revision: editingPlan.revision,
                content,
              },
              '惊喜计划已保存。',
            );
            if (success) setEditingPlan(null);
          }}
          onDelete={async () => {
            const success = await execute(
              {
                action: 'plan.delete',
                id: editingPlan.id,
                revision: editingPlan.revision,
                confirmed: true,
              },
              '已删除惊喜计划。',
            );
            if (success) setEditingPlan(null);
          }}
        />
      )}
    </section>
  );
}

function DraftEditor({
  title,
  item,
  onClose,
  onSave,
  onDelete,
  busy,
  error,
}: {
  title: string;
  item: V4Book | V4Plan;
  onClose: () => void;
  onSave: (title: string, content: string) => Promise<void>;
  onDelete: () => Promise<void>;
  busy: boolean;
  error: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const close = () => {
    if (!busy && (content === item.content || confirm('修改尚未保存，确定关闭？'))) onClose();
  };
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="v4-modal"
      ref={dialog}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="v4-modal-title">
        <h2>{title}</h2>
        <button onClick={close} disabled={busy} aria-label="关闭编辑">
          关闭
        </button>
      </div>
      <label>
        标题
        <input
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          disabled={'budget' in item}
        />
      </label>
      <label>
        Markdown 草稿
        <textarea
          value={content}
          rows={12}
          maxLength={12000}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      <div className="v4-preview">
        <MarkdownPreview source={content} />
      </div>
      {'photos' in item && item.photos.length > 0 && (
        <div className="v4-photo-grid" aria-label="回忆录照片">
          {item.photos.map((photo) => (
            <img key={photo.id} src={'/api/uploads/' + photo.id} alt={photo.alt} />
          ))}
        </div>
      )}
      <p>生成内容是未来活动建议，不代表已经发生的事实；所有商家、价格和时间安排需自行核实。</p>
      {error && <p role="alert">{error}</p>}
      <div className="v4-actions">
        <button onClick={() => download(name, content)}>
          <Download size={16} /> Markdown
        </button>

        <button disabled={busy} onClick={() => void onSave(name, content)} className="primary">
          保存草稿
        </button>
        <button
          disabled={busy}
          onClick={() => {
            if (confirm('确定永久删除这份草稿？')) void onDelete();
          }}
        >
          <Trash2 size={16} /> 删除
        </button>
      </div>
    </dialog>
  );
}
