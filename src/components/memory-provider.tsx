'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { memories as demoMemories } from '@/data/demo';
import { api } from '@/lib/client-api';
import { toMemoryView, type MemoryView } from '@/lib/memory/adapter';
import type { MemoryRecord } from '@/lib/memory/model';
import { Starfield } from './starfield';
type MemoryState = {
  mode: 'demo' | 'private';
  user: string | null;
  records: MemoryRecord[];
  memories: MemoryView[];
  reload: () => Promise<void>;
  logout: () => Promise<void>;
};
const Context = createContext<MemoryState | null>(null);
export function useMemories() {
  const value = useContext(Context);
  if (!value) throw Error('缺少 MemoryProvider');
  return value;
}
export function MemoryProvider({
  mode,
  children,
}: {
  mode: 'demo' | 'private';
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<string | null>(null);
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [checking, setChecking] = useState(mode === 'private');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const clear = useCallback(() => {
    generation.current++;
    setUser(null);
    setRecords([]);
    setChecking(false);
  }, []);
  const reload = useCallback(async () => {
    const current = generation.current;
    const data = await api<MemoryRecord[]>('/api/memories');
    if (current === generation.current) setRecords(data);
  }, []);
  const check = useCallback(async () => {
    const current = generation.current;
    try {
      const session = await api<{ user: { email: string } }>('/api/auth/session');
      if (current !== generation.current) return;
      const data = await api<MemoryRecord[]>('/api/memories');
      if (current !== generation.current) return;
      setUser(session.user.email);
      setRecords(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    if (mode === 'demo') return;
    const lost = () => {
      clear();
      setError('登录已过期，请重新登录。');
    };
    window.addEventListener('loveverse-auth-lost', lost);
    void check();
    return () => {
      generation.current++;
      window.removeEventListener('loveverse-auth-lost', lost);
    };
  }, [mode, check, clear]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (!document.hidden) void check();
    };
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [user, check]);
  const logout = async () => {
    await api('/api/auth/session', { method: 'DELETE' });
    clear();
  };
  const memories = useMemo(
    () => (mode === 'demo' ? demoMemories : records.map(toMemoryView)),
    [mode, records],
  );
  if (mode === 'private' && !user)
    return (
      <div className="app-shell">
        <Starfield />
        <main className="private-login">
          <span className="eyebrow">LOVE MEMORY · PRIVATE SPACE</span>
          <h1>欢迎回到，我们的小宇宙。</h1>
          <p>登录后，才会加载属于你们的回忆。</p>
          {checking ? (
            <p role="status">正在验证会话…</p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setBusy(true);
                setError('');
                try {
                  await api('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({
                      email: form.get('email'),
                      password: form.get('password'),
                    }),
                  });
                  await check();
                } catch (err) {
                  setError(err instanceof Error ? err.message : '登录失败');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                邮箱
                <input name="email" type="email" required autoComplete="username" />
              </label>
              <label>
                密码
                <input
                  name="password"
                  type="password"
                  required
                  maxLength={256}
                  autoComplete="current-password"
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? '正在登录…' : '登录私人空间'}
              </button>
            </form>
          )}
          {error && <p role="alert">{error}</p>}
          <small>
            新环境请先在服务器运行 npm run private:setup。未配置账号时不会开放私人数据。
          </small>
        </main>
      </div>
    );
  return (
    <Context.Provider value={{ mode, user, records, memories, reload, logout }}>
      {error && mode === 'private' && (
        <p className="memory-banner" role="alert">
          {error}
        </p>
      )}
      {children}
    </Context.Provider>
  );
}
