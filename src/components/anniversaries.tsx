'use client';
import { useEffect, useState } from 'react';
import { Heart, Plus, Trash2 } from 'lucide-react';
import { couple } from '@/data/demo';
import { dateValue, daysBetween, nextAnniversary, todayInShanghai } from '@/lib/dates';
type Anniversary = { id: string; title: string; date: string; yearly: boolean };
const KEY = 'loveverse.anniversaries.v1';
export function Anniversaries() {
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
      setItems(
        data.filter((x): x is Anniversary => {
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
        }),
      );
    } catch {
      setError('本地记录无法读取，你仍可以添加新的纪念日。');
    }
    return () => clearInterval(timer);
  }, []);
  function save(next: Anniversary[]) {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setError('');
      setStatus('已保存到此浏览器');
    } catch {
      setError('浏览器存储不可用，本次修改仅在当前页面有效。');
    }
  }
  const all = [
    { id: 'start', title: '我们的恋爱纪念日', date: couple.start, yearly: true },
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
      <div className="days-banner">
        <Heart size={28} />
        <p>我们已经一起走过</p>
        <strong>
          {today ? Math.max(0, daysBetween(couple.start, today)) : '—'}
          <small>天</small>
        </strong>
        <span>从 {couple.start} 开始 · 按上海日期计算</span>
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
                    onClick={() => save(items.filter((x) => x.id !== item.id))}
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
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const title = String(data.get('title')).trim();
          const date = String(data.get('date'));
          try {
            dateValue(date);
            if (!title) throw Error('请填写纪念日名称');
            save([
              ...items,
              { id: crypto.randomUUID(), title, date, yearly: data.get('yearly') === 'on' },
            ]);
            e.currentTarget.reset();
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
          <button className="primary" type="submit">
            保存纪念日 <Plus size={16} />
          </button>
        </div>
        <small>只保存在当前浏览器，不会同步给另一台设备。</small>
        <p role="status">{status}</p>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
