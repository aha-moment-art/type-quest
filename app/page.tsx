"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LETTERS = ["flux", "orbit", "pixel", "nova", "shift", "vector", "quick", "blaze", "echo", "glitch", "tempo", "laser"];
const SYMBOLS = ["!", "?", "@", "#", "$", "%", "&", "*", "+", "-", "=", ":", ";", "/", "_", ".", ","];

type Level = "热身" | "进阶" | "极限";
type GameState = "ready" | "playing" | "paused" | "over";

function makeTarget(level: Level) {
  const groups = level === "热身" ? 4 : level === "进阶" ? 6 : 8;
  return Array.from({ length: groups }, (_, i) => {
    const word = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const number = Math.floor(Math.random() * (level === "热身" ? 90 : 900)) + 10;
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    if (level === "热身") return i % 2 ? `${number}${symbol}` : word;
    if (level === "进阶") return i % 2 ? `${word}${symbol}${number}` : `${number}${symbol}${word}`;
    const upper = word.split("").map((c) => Math.random() > .62 ? c.toUpperCase() : c).join("");
    return i % 2 ? `${symbol}${upper}_${number}` : `${number}${symbol}${upper}`;
  }).join(" ");
}

export default function Home() {
  const [level, setLevel] = useState<Level>("进阶");
  const [status, setStatus] = useState<GameState>("ready");
  const [target, setTarget] = useState(() => makeTarget("进阶"));
  const [index, setIndex] = useState(0);
  const [time, setTime] = useState(60);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [lives, setLives] = useState(3);
  const [flash, setFlash] = useState<"good" | "bad" | "">("");
  const [record, setRecord] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scoreRef = useRef(0);

  useEffect(() => { setRecord(Number(localStorage.getItem("type-quest-record") || 0)); }, []);
  const accuracy = correct + mistakes ? Math.round(correct / (correct + mistakes) * 100) : 100;
  const wpm = Math.round((correct / 5) / Math.max(1 / 60, (60 - time) / 60));

  useEffect(() => { scoreRef.current = score; }, [score]);

  const finish = useCallback(() => {
    setStatus("over");
    setRecord((old) => {
      const next = Math.max(old, scoreRef.current);
      localStorage.setItem("type-quest-record", String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => setTime((t) => {
      if (t <= 1) { window.clearInterval(timer); setTimeout(finish, 0); return 0; }
      return t - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [status, finish]);

  const start = () => {
    setTarget(makeTarget(level)); setIndex(0); setTime(60); setScore(0); setCombo(0);
    setBestCombo(0); setCorrect(0); setMistakes(0); setLives(3); setStatus("playing");
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const hitKey = (key: string) => {
    if (status !== "playing" || key.length !== 1) return;
    if (key === target[index]) {
      const nextCombo = combo + 1;
      setCorrect((v) => v + 1); setCombo(nextCombo); setBestCombo((v) => Math.max(v, nextCombo));
      setScore((v) => v + 10 + Math.min(40, Math.floor(nextCombo / 5) * 2));
      setFlash("good");
      if (index + 1 >= target.length) { setTarget(makeTarget(level)); setIndex(0); setLives((v) => Math.min(3, v + 1)); }
      else setIndex((v) => v + 1);
    } else {
      setMistakes((v) => v + 1); setCombo(0); setScore((v) => Math.max(0, v - 5)); setFlash("bad");
      setLives((v) => { const next = v - 1; if (next <= 0) setTimeout(finish, 0); return Math.max(0, next); });
    }
    window.setTimeout(() => setFlash(""), 110);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (status === "playing" || status === "paused")) {
        setStatus((s) => s === "playing" ? "paused" : "playing"); return;
      }
      if (status === "playing") { e.preventDefault(); hitKey(e.key); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const chars = useMemo(() => target.split(""), [target]);

  return (
    <main className={`app ${flash}`} onClick={() => inputRef.current?.focus()}>
      <input ref={inputRef} className="key-catcher" inputMode="text" aria-label="打字输入区"
        onChange={(e) => { const value = e.target.value; if (value) hitKey(value.at(-1)!); e.target.value = ""; }} />

      <header className="topbar">
        <a className="brand" href="#" aria-label="Type Quest 首页"><span className="brand-mark">TQ</span><span>TYPE QUEST<small>键盘冒险计划</small></span></a>
        <div className="record"><span>个人纪录</span><strong>{record.toLocaleString()}</strong><i>PTS</i></div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span /> 60 秒街机挑战 <span /></div>
        <h1>指尖就位，<em>开始闯关</em></h1>
        <p>字母 × 数字 × 标点混合训练。保持准确，累积连击，让每一次敲击都算数。</p>
      </section>

      <section className="game-shell" aria-label="打字游戏区">
        <div className="hud">
          <div className="stat"><span>TIME</span><strong>{String(time).padStart(2, "0")}<small>s</small></strong></div>
          <div className="stat"><span>SCORE</span><strong>{score.toLocaleString()}</strong></div>
          <div className="stat combo"><span>COMBO</span><strong>×{combo}</strong></div>
          <div className="lives" aria-label={`剩余 ${lives} 条生命`}>
            {[0,1,2].map((n) => <span key={n} className={n < lives ? "alive" : ""}>♥</span>)}
          </div>
        </div>

        <div className="arena">
          <div className="grid-lines" />
          {status === "ready" && <div className="overlay intro">
            <span className="round-badge">01</span><h2>选择难度，准备出发</h2><p>准确输入屏幕上的字符。输错会失去一颗能量心。</p>
            <div className="levels">{(["热身","进阶","极限"] as Level[]).map((item) => <button key={item} onClick={() => {setLevel(item); setTarget(makeTarget(item));}} className={level === item ? "selected" : ""}><b>{item}</b><small>{item === "热身" ? "字母 + 数字" : item === "进阶" ? "完整混合" : "大小写狂潮"}</small></button>)}</div>
            <button className="start-button" onClick={start}><span>开始挑战</span><kbd>ENTER</kbd></button>
          </div>}

          {(status === "playing" || status === "paused") && <div className="playfield">
            <div className="mission"><span>当前任务</span><i>{level}模式</i></div>
            <div className="target" aria-live="polite">{chars.map((char, i) => <span key={`${target}-${i}`} className={i < index ? "done" : i === index ? "current" : "pending"}>{char === " " ? "·" : char}</span>)}</div>
            <div className="progress"><i style={{width: `${index / target.length * 100}%`}} /></div>
            <div className="next-key">下一键 <kbd>{target[index] === " " ? "SPACE" : target[index]}</kbd></div>
          </div>}

          {status === "paused" && <div className="pause-screen"><span>PAUSED</span><h2>冒险暂停</h2><button onClick={() => setStatus("playing")}>继续游戏</button></div>}

          {status === "over" && <div className="overlay result"><span className="result-label">本局完成</span><h2>{score.toLocaleString()} <small>PTS</small></h2><div className="result-grid"><div><strong>{wpm}</strong><span>WPM</span></div><div><strong>{accuracy}%</strong><span>准确率</span></div><div><strong>×{bestCombo}</strong><span>最高连击</span></div></div><button className="start-button" onClick={start}><span>再玩一次</span><kbd>↵</kbd></button></div>}
        </div>

        <div className="game-footer"><span><kbd>ESC</kbd> 暂停 / 继续</span><span>准确率 <b>{accuracy}%</b></span><span>速度 <b>{wpm} WPM</b></span></div>
      </section>

      <footer><span>TYPE QUEST / 2026</span><p>慢即是稳，稳即是快。</p><span>LEVEL: {level.toUpperCase()}</span></footer>
    </main>
  );
}
