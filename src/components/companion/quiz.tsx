'use client';
import { useState } from 'react';
type Event = { id: string; title: string; date: string; place: string };
export function CompanionQuiz({ events }: { events: Event[] }) {
  const [round, setRound] = useState<Event[] | null>(null);
  const source = round ?? events;
  const [mode, setMode] = useState<'place' | 'date' | 'mixed' | 'match'>('mixed'),
    [player, setPlayer] = useState(0),
    [index, setIndex] = useState(0),
    [answers, setAnswers] = useState<string[][]>([[], []]),
    [handoff, setHandoff] = useState(false),
    [started, setStarted] = useState(false);
  const questions = source
    .slice(0, 6)
    .map((e, i) => {
      const key = mode === 'date' ? 'date' : mode === 'place' ? 'place' : i % 2 ? 'date' : 'place';
      return {
        event: e,
        key,
        answer: e[key],
        options: [...new Set(source.map((x) => x[key]).filter(Boolean))].slice(0, 30),
      };
    })
    .filter((q) => q.answer);
  const reset = () => {
    setPlayer(0);
    setIndex(0);
    setAnswers([[], []]);
    setHandoff(false);
    setStarted(false);
    setRound(null);
  };
  const done = player === 2;
  const q = questions[index];
  return (
    <div className="v4-card">
      <h2>一起重温，看看谁记得</h2>
      <label>
        游戏类型
        <select
          value={mode}
          disabled={started}
          onChange={(e) => {
            setMode(e.target.value as typeof mode);
            reset();
          }}
        >
          <option value="mixed">恋爱回忆问答</option>
          <option value="place">地点猜谜</option>
          <option value="date">时间猜谜</option>
          <option value="match">双人默契测试</option>
        </select>
      </label>
      <p>仅从真实回忆生成；同一设备轮流作答，双方答完后才揭晓答案。不读取秘密计划或胶囊。</p>
      {!questions.length ? (
        <p>还没有足够的真实回忆，请先记录日期与地点。</p>
      ) : done ? (
        <div role="status">
          <h3>挑战完成</h3>
          {answers.map((a, p) => (
            <p key={p}>
              成员 {p + 1}：{a.filter((v, i) => v === questions[i].answer).length} /{' '}
              {questions.length} 分
            </p>
          ))}
          <p>
            默契一致：{answers[0].filter((v, i) => v === answers[1][i]).length} / {questions.length}
          </p>
          {questions.map((q, i) => (
            <p key={q.event.id}>
              {q.event.title}：{q.answer} · 双方选择 {answers[0][i]} / {answers[1][i]}
            </p>
          ))}
        </div>
      ) : handoff ? (
        <>
          <p>成员 1 已完成，请把屏幕交给另一位成员。</p>
          <button
            onClick={() => {
              setHandoff(false);
              setPlayer(1);
              setIndex(0);
            }}
          >
            成员 2 开始
          </button>
        </>
      ) : (
        <>
          <p>
            成员 {player + 1} · 第 {index + 1} / {questions.length} 题
          </p>
          <h3>
            「{q.event.title}」发生在{q.key === 'date' ? '哪一天' : '哪里'}？
          </h3>
          <div className="v4-answer-grid">
            {q.options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  setStarted(true);
                  if (!round) setRound(events);
                  setAnswers((old) => old.map((a, p) => (p === player ? [...a, option] : a)));
                  if (index + 1 < questions.length) setIndex(index + 1);
                  else if (player === 0) setHandoff(true);
                  else setPlayer(2);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
      <button onClick={reset}>重新挑战</button>
    </div>
  );
}
