'use client';
import { useEffect, useRef, useState } from 'react';
import { Heart, Plus, Trash2 } from 'lucide-react';
import { dateValue, daysBetween, nextAnniversary, todayInShanghai } from '@/lib/dates';
import { useMemories } from './memory-provider';
import { api } from '@/lib/client-api';
type Anniversary = { id: string; title: string; date: string; yearly: boolean };
const KEY = 'loveverse.anniversaries.v1';
export function Anniversaries() {
  const { mode, couple } = useMemories();
  const requestVersion = useRef(0);
  const writing = useRef(false);
  const [revision, setRevision] = useState('');
  const [imported, setImported] = useState(false);
  const [legacy, setLegacy] = useState<Anniversary[]>([]);
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState('');
  const [items, setItems] = useState<Anniversary[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    const update = () => setToday(todayInShanghai());
    update();
    const timer = setInterval(update, 30000);
    try {
      const data: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(data)) throw Error();
      const valid = data.filter((x): x is Anniversary => {
        try {
          return (
            typeof x.id === 'string' &&
            typeof x.title === 'string' &&
            typeof x.yearly === 'boolean' &&
            Number.isFinite(dateValue(x.date))
          );
        } catch {
          return false;
        }
      });
      if (mode === 'demo') setItems(valid);
      else setLegacy(valid);
    } catch {
      setError('本地记录无法读取，你仍可以添加新的纪念日。');
    }
    if (mode === 'private') {
      let active = true;
      const refresh = () => {
        if (document.hidden || writing.current) return;
        const version = ++requestVersion.current;
        if (!document.hidden)
          api<{ items: Anniversary[]; revision: string; imported: boolean }>('/api/anniversaries')
            .then((data) => {
              if (active && version === requestVersion.current) {
                setItems(data.items);
                setRevision(data.revision);
                setImported(data.imported);
              }
            })
            .catch((e) => {
              if (active && version === requestVersion.current) setError(e.message);
            });
      };
      refresh();
      window.addEventListener('focus', refresh);
      return () => {
        active = false;
        clearInterval(timer);
        window.removeEventListener('focus', refresh);
      };
    }
    return () => clearInterval(timer);
  }, [mode]);
  async function save(next: Anniversary[]) {
    if (mode === 'private') {
      writing.current = true;
      requestVersion.current++;
      setBusy(true);
      setError('');
      try {
        const data = await api<{ items: Anniversary[]; revision: string }>('/api/anniversaries', {
          method: 'PUT',
          body: JSON.stringify({ items: next, revision }),
        });
        setItems(data.items);
        setRevision(data.revision);
        setStatus('已保存到私人空间，其他设备重新加载后可见。');
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : '保存失败');
        return false;
      } finally {
        writing.current = false;
        setBusy(false);
      }
    }
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setError('');
      setStatus('已保存到此浏览器');
    } catch {
      setError('浏览器存储不可用，本次修改仅在当前页面有效。');
    }
    return true;
  }
  const all = [
    ...(couple.start
      ? [{ id: 'start', title: '我们的恋爱纪念日', date: couple.start, yearly: true }]
      : []),
    ...items,
  ];
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">EVERY DAY COUNTS</span>
          <h1>把未来，慢慢过成回忆。</h1>
          <p>每一个值得期待的日子，都有你。</p>
        </div>
      </div>
      {mode === 'private' && legacy.length > 0 && !imported && (
        <div className="memory-banner">
          <p>
            发现此浏览器中 {legacy.length} 条旧版纪念日。导入会上传到私人空间，原浏览器记录会保留。
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (
                !window.confirm(
                  `确认把此浏览器的 ${legacy.length} 条纪念日导入私人空间？仅导入一次，不删除原记录。`,
                )
              )
                return;
              writing.current = true;
              requestVersion.current++;
              setBusy(true);
              setError('');
              try {
                const data = await api<{
                  items: Anniversary[];
                  revision: string;
                  imported: boolean;
                }>('/api/anniversaries/import', {
                  method: 'POST',
                  body: JSON.stringify({ items: legacy, confirmed: true }),
                });
                setItems(data.items);
                setRevision(data.revision);
                setImported(data.imported);
                setStatus('导入成功，原浏览器数据已保留。');
              } catch (e) {
                setError(e instanceof Error ? e.message : '导入失败');
              } finally {
                writing.current = false;
                setBusy(false);
              }
            }}
          >
            确认导入旧版纪念日
          </button>
        </div>
      )}
      <div className="days-banner">
        <Heart size={28} />
        <p>我们已经一起走过</p>
        <strong>
          {today && couple.start ? Math.max(0, daysBetween(couple.start, today)) : '—'}
          <small>天</small>
        </strong>
        <span>
          {couple.start
            ? `从 ${couple.start} 开始 · 按上海日期计算`
            : '尚未设置相恋日期，请在服务器配置后重启。'}
        </span>
      </div>
      <div className="anniversary-list">
        {all.map((item) => {
          const next = today
            ? item.yearly
              ? nextAnniversary(item.date, today)
              : item.date
            : item.date;
          const days = today ? daysBetween(today, next) : 0;
          return (
            <article key={item.id}>
              <div>
                <span className="eyebrow">
                  {item.yearly ? '每年相约' : '特别约定'} · {next}
                </span>
                <h2>{item.title}</h2>
              </div>
              <div className="countdown">
                {today
                  ? days === 0
                    ? '就是今天'
                    : days < 0
                      ? `已过 ${-days} 天`
                      : `还有 ${days} 天`
                  : '计算中'}
                {item.id !== 'start' && (
                  <button
                    className="icon-button"
                    aria-label={`删除${item.title}`}
                    disabled={busy || (mode === 'private' && !revision)}
                    onClick={() => {
                      if (mode === 'demo' || window.confirm(`确定删除纪念日「${item.title}」？`))
                        void save(items.filter((x) => x.id !== item.id));
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <form
        className="anniversary-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const title = String(data.get('title')).trim();
          const date = String(data.get('date'));
          try {
            dateValue(date);
            if (!title) throw Error('请填写纪念日名称');
            const saved = await save([
              ...items,
              { id: crypto.randomUUID(), title, date, yearly: data.get('yearly') === 'on' },
            ]);
            if (saved) form.reset();
          } catch (err) {
            setError(err instanceof Error ? err.message : '请检查输入');
          }
        }}
      >
        <h2>
          <Plus size={18} /> 添加一个期待
        </h2>
        <div className="form-fields">
          <label>
            纪念日名称
            <input name="title" required maxLength={40} placeholder="比如：下一次旅行" />
          </label>
          <label>
            日期
            <input name="date" type="date" required />
          </label>
          <label className="checkbox">
            <input type="checkbox" name="yearly" defaultChecked /> 每年重复
          </label>
          <button
            className="primary"
            type="submit"
            disabled={busy || (mode === 'private' && !revision)}
          >
            保存纪念日 <Plus size={16} />
          </button>
        </div>
        <small>
          {mode === 'demo'
            ? '只保存在当前浏览器，不会同步给另一台设备。'
            : '保存在私人服务器；其他设备打开页面或重新聚焦后同步。原有浏览器记录不会被删除。'}
        </small>
        <p role="status">{status}</p>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
