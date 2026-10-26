'use client';
import { useEffect, useState } from 'react';
import { motion, MotionConfig } from 'motion/react';
import {
  Orbit,
  Heart,
  ArrowRight,
  ArrowDown,
  Sparkles,
  Image as ImageIcon,
  Route,
  CalendarHeart,
  Gamepad2,
  Home,
} from 'lucide-react';
import { memories, couple, type Memory } from '@/data/demo';
import { daysBetween, todayInShanghai } from '@/lib/dates';
import { Starfield } from './starfield';
import { Memories, MemoryDetail } from './memories';
import { Anniversaries } from './anniversaries';
import { Games } from './games';
const tabs = [
  { id: 'home', title: '首页', icon: Home },
  { id: 'universe', title: '恋爱宇宙', icon: Orbit },
  { id: 'photos', title: '照片墙', icon: ImageIcon },
  { id: 'timeline', title: '时间轴', icon: Route },
  { id: 'dates', title: '纪念日', icon: CalendarHeart },
  { id: 'games', title: '情侣小游戏', icon: Gamepad2 },
] as const;
type Tab = (typeof tabs)[number]['id'];
export function LoveVerse() {
  const [tab, setTab] = useState<Tab>('home');
  const [selected, setSelected] = useState<Memory | null>(null);
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const sync = () => {
      const hash = location.hash.slice(1);
      if (hash === 'main') return;
      setTab(tabs.some((t) => t.id === hash) ? (hash as Tab) : 'home');
    };
    sync();
    window.addEventListener('hashchange', sync);
    const update = () => setDays(Math.max(0, daysBetween(couple.start, todayInShanghai())));
    update();
    const timer = setInterval(update, 30000);
    return () => {
      window.removeEventListener('hashchange', sync);
      clearInterval(timer);
    };
  }, []);
  function navigate(value: Tab) {
    setTab(value);
    location.hash = value;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <Starfield />
        <a className="skip-link" href="#main">
          跳转到主要内容
        </a>
        <header className="site-header">
          <a
            href="#home"
            className="brand"
            onClick={() => navigate('home')}
            aria-label="LoveVerse 首页"
          >
            <Orbit className="brand-mark" size={30} />
            <span>
              LoveVerse<small>恋 爱 宇 宙</small>
            </span>
          </a>
          <nav aria-label="主导航">
            {tabs.map(({ id, title, icon: Icon }) => (
              <a
                href={`#${id}`}
                key={id}
                onClick={() => navigate(id)}
                className={tab === id ? 'active' : ''}
                aria-current={tab === id ? 'page' : undefined}
              >
                <Icon size={17} />
                <span>{title}</span>
              </a>
            ))}
          </nav>
          <div className="couple-badge">
            <span>宇</span>
            <span>星</span>
            <Heart size={11} />
            <small>我们的专属空间</small>
          </div>
        </header>
        <main id="main">
          {tab === 'home' || tab === 'universe' ? (
            <>
              <section className={`hero ${tab === 'universe' ? 'universe-view' : ''}`}>
                <motion.div
                  className="hero-copy"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <span className="eyebrow">
                    <span className="live-dot" /> A UNIVERSE, JUST FOR TWO
                  </span>
                  <h1>
                    {tab === 'home' ? (
                      <>
                        宇宙很大，
                        <br />
                        而你是我的<span className="serif-accent">唯一坐标。</span>
                      </>
                    ) : (
                      <>
                        每一次心动，
                        <br />
                        都有一颗<span className="serif-accent">专属星球。</span>
                      </>
                    )}
                  </h1>
                  <p>
                    把相遇写成星辰，把日常酿成浪漫。
                    <br />
                    在这片小小宇宙里，收藏我们的大大喜欢。
                  </p>
                  <div className="hero-actions">
                    <button
                      className="primary"
                      onClick={() =>
                        tab === 'home' ? navigate('universe') : setSelected(memories[0])
                      }
                    >
                      {tab === 'home' ? '进入我们的宇宙' : '从第一颗星球开始'}
                      <ArrowRight size={17} />
                    </button>
                    <button className="text-button" onClick={() => navigate('timeline')}>
                      回看我们的故事 <ArrowUp />
                    </button>
                  </div>
                  <div className="together">
                    <span className="heart-orbit">
                      <Heart size={18} />
                    </span>
                    <span>
                      已经一起走过 <strong>{days ?? '—'}</strong> 天
                      <small>始于 {couple.start.replaceAll('-', '.')}，不止于朝夕。</small>
                    </span>
                  </div>
                </motion.div>
                <div className="universe-map" aria-label="回忆星图">
                  <div className="orbit-line orbit-one" />
                  <div className="orbit-line orbit-two" />
                  <div className="orbit-line orbit-three" />
                  <span className="map-coordinate">RA 05h 20m · DEC +∞</span>
                  <div className="central-planet">
                    <span className="planet-ring" />
                    <div className="planet-core" />
                    <div className="planet-label">
                      <Heart size={13} /> OUR LITTLE UNIVERSE
                    </div>
                  </div>
                  {memories.map((m, i) => (
                    <button
                      className={`memory-planet planet-${i} ${m.color}`}
                      key={m.id}
                      onClick={() => setSelected(m)}
                      aria-label={`探索${m.category}：${m.title}`}
                    >
                      <span className="mini-planet" />
                      <span className="satellite-caption">
                        {m.category}
                        <small>{m.date.replaceAll('-', '.')}</small>
                      </span>
                    </button>
                  ))}
                  <span className="map-star star-one">✧</span>
                  <span className="map-star star-two">✦</span>
                  <span className="map-star star-three">+</span>
                  <div className="map-note">
                    <span className="live-dot" /> 点击星球，拾起一段我们的回忆
                  </div>
                </div>
                <span className="hero-index">CHAPTER 01 / OUR UNIVERSE</span>
              </section>
              <section className="explore-section">
                <div className="explore-heading">
                  <span>
                    <Sparkles size={16} /> 每一份喜欢，都有迹可循
                  </span>
                  <span>
                    继续探索我们 <ArrowDown size={14} />
                  </span>
                </div>
                <div className="explore-grid">
                  {[
                    {
                      id: 'photos' as const,
                      icon: ImageIcon,
                      n: '01',
                      title: '心动收藏夹',
                      sub: '把每一帧的我们，认真收藏',
                      image: '/demo/sea.png',
                    },
                    {
                      id: 'timeline' as const,
                      icon: Route,
                      n: '02',
                      title: '我们的故事线',
                      sub: '从初次见面，到未来的每一天',
                      image: '/demo/sunset.jpg',
                    },
                    {
                      id: 'games' as const,
                      icon: Gamepad2,
                      n: '03',
                      title: '恋爱补给站',
                      sub: '一点默契，一点惊喜，很多喜欢',
                      image: '/demo/night.jpg',
                    },
                  ].map(({ id, icon: Icon, n, title, sub, image }) => (
                    <button className="explore-card" key={id} onClick={() => navigate(id)}>
                      <img src={image} alt="" />
                      <div className="explore-overlay" />
                      <div className="explore-top">
                        <Icon size={20} />
                        <span>{n} /</span>
                      </div>
                      <div className="explore-copy">
                        <h2>{title}</h2>
                        <p>{sub}</p>
                      </div>
                      <ArrowRight className="explore-arrow" size={18} />
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : tab === 'photos' ? (
            <Memories />
          ) : tab === 'timeline' ? (
            <Memories timeline />
          ) : tab === 'dates' ? (
            <Anniversaries />
          ) : (
            <Games />
          )}
        </main>
        <footer>
          <span>
            <Orbit size={15} /> LoveVerse <span className="footer-line">/</span> 让爱有迹可循
          </span>
          <span>
            MADE OF LITTLE MOMENTS & BIG LOVE <Heart size={12} />
          </span>
          <small>演示宇宙 · {couple.names}</small>
        </footer>
        {selected && <MemoryDetail memory={selected} onClose={() => setSelected(null)} />}
      </div>
    </MotionConfig>
  );
}
function ArrowUp() {
  return <ArrowRight size={14} className="rotate-[-35deg]" />;
}
