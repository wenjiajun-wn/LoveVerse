'use client';
import { useState } from 'react';
import { HeartHandshake, Sparkles, Gift, ArrowRight } from 'lucide-react';
import { memoryQuestions, preferenceQuestions, surprises } from '@/data/demo';
import { Modal } from './modal';
type Game = 'match' | 'quiz' | 'box';
export function Games() {
  const [game, setGame] = useState<Game | null>(null);
  const [round, setRound] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [handoff, setHandoff] = useState(false);
  const [gift, setGift] = useState('');
  const [feedback, setFeedback] = useState('');
  function start(type: Game) {
    setGame(type);
    setRound(0);
    setAnswers([]);
    setScore(0);
    setHandoff(false);
    setGift('');
    setFeedback('');
  }
  const complete =
    game === 'quiz' ? round >= memoryQuestions.length : round >= preferenceQuestions.length * 2;
  function answer(index: number) {
    if (game === 'quiz') {
      if (index === memoryQuestions[round].answer) setScore((s) => s + 1);
      setFeedback(
        index === memoryQuestions[round].answer
          ? '答对了，这份回忆被好好收藏着。'
          : `这次的答案是：${memoryQuestions[round].options[memoryQuestions[round].answer]}`,
      );
    } else {
      if (round < 3) {
        setAnswers((a) => [...a, index]);
        if (round === 2) setHandoff(true);
      } else if (answers[round - 3] === index) setScore((s) => s + 1);
    }
    setRound((r) => r + 1);
  }
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">A LITTLE MORE US</span>
          <h1>一起玩，让心再靠近一点。</h1>
          <p>没有输赢，只有关于我们的新发现。</p>
        </div>
      </div>
      <div className="game-grid">
        {[
          {
            id: 'match' as const,
            icon: HeartHandshake,
            title: '默契实验室',
            text: '轮流回答 3 个问题，看看我们的心动频率。',
            tag: '双人 · 约 2 分钟',
          },
          {
            id: 'quiz' as const,
            icon: Sparkles,
            title: '回忆放映室',
            text: '那些共同经历的小事，你还记得多少？',
            tag: '单人或双人 · 3 道题',
          },
          {
            id: 'box' as const,
            icon: Gift,
            title: '心动盲盒',
            text: '拆开今天的小惊喜，为日常加一点甜。',
            tag: '随机惊喜 · 随时开启',
          },
        ].map(({ id, icon: Icon, title, text, tag }) => (
          <button className={`game-card ${id}`} key={id} onClick={() => start(id)}>
            <span className="game-art">
              <Icon size={60} strokeWidth={1} />
            </span>
            <small>{tag}</small>
            <h2>{title}</h2>
            <p>{text}</p>
            <span className="game-link">
              开始探索 <ArrowRight size={16} />
            </span>
          </button>
        ))}
      </div>
      {game && (
        <Modal title={game === 'box' ? '心动盲盒' : '情侣小游戏'} onClose={() => setGame(null)}>
          <div className="game-dialog">
            {game === 'box' ? (
              <>
                <Gift size={55} />
                <span className="eyebrow">A SURPRISE FOR TWO</span>
                <h2>{gift ? '今天的小小约定' : '有一份心动，等待拆封。'}</h2>
                <p aria-live="polite">{gift || '每次开启，都是一个一起度过的好理由。'}</p>
                <button
                  className="primary"
                  onClick={() => {
                    const options = surprises.filter((x) => x !== gift);
                    setGift(options[Math.floor(Math.random() * options.length)]);
                  }}
                >
                  {gift ? '再抽一个' : '拆开盲盒'} <Sparkles size={17} />
                </button>
              </>
            ) : handoff ? (
              <>
                <HeartHandshake size={48} />
                <h2>现在，把屏幕交给 TA。</h2>
                <p>你的答案已经收好。让另一位独立选择，再揭晓默契。</p>
                <button className="primary" onClick={() => setHandoff(false)}>
                  我准备好了
                </button>
              </>
            ) : complete ? (
              <>
                <Sparkles size={48} />
                <span className="eyebrow">
                  {game === 'match' ? 'OUR CONNECTION' : 'MEMORY REPLAY'}
                </span>
                <h2>
                  {game === 'match'
                    ? `默契值 ${Math.round((score / 3) * 100)}%`
                    : `回忆命中 ${score} / 3`}
                </h2>
                <p>{feedback}</p>
                <p>相同的答案让人惊喜，不同的答案让我们更了解彼此。</p>
                <button className="primary" onClick={() => start(game)}>
                  再玩一次
                </button>
              </>
            ) : (
              <>
                <span className="eyebrow">
                  {game === 'match' ? `第 ${round < 3 ? '一' : '二'} 位玩家` : '回忆问答'} ·{' '}
                  {(round % 3) + 1} / 3
                </span>
                <h2>
                  {(game === 'quiz' ? memoryQuestions[round] : preferenceQuestions[round % 3]).text}
                </h2>
                <div className="answers">
                  {(game === 'quiz'
                    ? memoryQuestions[round]
                    : preferenceQuestions[round % 3]
                  ).options.map((option, index) => (
                    <button key={option} onClick={() => answer(index)}>
                      <span>{String.fromCharCode(65 + index)}</span>
                      {option}
                    </button>
                  ))}
                </div>
                <p role="status">{feedback}</p>
              </>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
