"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LETTERS = ["flux", "orbit", "pixel", "nova", "shift", "vector", "quick", "blaze", "echo", "glitch", "tempo", "laser"];
const SYMBOLS = ["!", "?", "@", "#", "$", "%", "&", "*", "+", "-", "=", ":", ";", "/", "_", ".", ","];
const KEY_ROWS = ["1234567890-=", "qwertyuiop[]\\", "asdfghjkl;'", "zxcvbnm,./", " "];
const SHIFT_BASE: Record<string, string> = {"!":"1","@":"2","#":"3","$":"4","%":"5","^":"6","&":"7","*":"8","(":"9",")":"0","_":"-","+":"=","{":"[","}":"]","|":"\\",":":";",'"':"'","<":",",">":".","?":"/"};
const FINGER_KEYS: Record<string, string> = {
  "LEFT PINKY":"`1qaz", "LEFT RING":"2wsx", "LEFT MIDDLE":"3edc", "LEFT INDEX":"45rtfgvb",
  "RIGHT INDEX":"67yuhjnm", "RIGHT MIDDLE":"8ik,", "RIGHT RING":"9ol.", "RIGHT PINKY":"0-=p[]\\;'/", "THUMB":" ",
};
const FINGERS = Object.keys(FINGER_KEYS);

type Level = "LETTERS" | "NUMBERS" | "SYMBOLS" | "RUSH" | "EXTREME";
type GameState = "ready" | "playing" | "paused" | "over";
let audioContext: AudioContext | null = null;

function keyBase(key: string) { return (SHIFT_BASE[key] || key).toLowerCase(); }
function fingerFor(key: string) { const base = keyBase(key); return FINGERS.find((name) => FINGER_KEYS[name].includes(base)) || "RIGHT PINKY"; }
function playSound(kind: "key" | "error") {
  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
  const now = audioContext.currentTime;
  if (kind === "error") {
    [0, .09].forEach((delay, i) => { const osc = audioContext!.createOscillator(); const gain = audioContext!.createGain(); osc.type = "square"; osc.frequency.value = i ? 145 : 190; gain.gain.setValueAtTime(.07, now + delay); gain.gain.exponentialRampToValueAtTime(.001, now + delay + .08); osc.connect(gain).connect(audioContext!.destination); osc.start(now + delay); osc.stop(now + delay + .09); });
    return;
  }
  const length = Math.floor(audioContext.sampleRate * .025); const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate); const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = audioContext.createBufferSource(); const filter = audioContext.createBiquadFilter(); const gain = audioContext.createGain(); source.buffer = buffer; filter.type = "highpass"; filter.frequency.value = 900; gain.gain.value = .12; source.connect(filter).connect(gain).connect(audioContext.destination); source.start(now);
}

function makeTarget(level: Level) {
  if (level === "LETTERS") return Array.from({ length: 8 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(" ");
  if (level === "NUMBERS") return Array.from({ length: 10 }, () => String(Math.floor(Math.random() * 900) + 10)).join(" ");
  if (level === "SYMBOLS") return Array.from({ length: 12 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]).join(" ");
  const groups = level === "RUSH" ? 6 : 8;
  return Array.from({ length: groups }, (_, i) => {
    const word = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const number = Math.floor(Math.random() * 900) + 10;
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    if (level === "RUSH") return i % 2 ? `${word}${symbol}${number}` : `${number}${symbol}${word}`;
    const upper = word.split("").map((c) => Math.random() > .62 ? c.toUpperCase() : c).join("");
    return i % 2 ? `${symbol}${upper}_${number}` : `${number}${symbol}${upper}`;
  }).join(" ");
}

export default function Home() {
  const [level, setLevel] = useState<Level>("RUSH");
  const [status, setStatus] = useState<GameState>("ready");
  const [target, setTarget] = useState(() => makeTarget("RUSH"));
  const [index, setIndex] = useState(0);
  const [time, setTime] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [flash, setFlash] = useState<"good" | "bad" | "">("");
  const [record, setRecord] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scoreRef = useRef(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRecord(Number(localStorage.getItem("vibetyping-record") || 0)));
    return () => cancelAnimationFrame(frame);
  }, []);
  const accuracy = correct + mistakes ? Math.round(correct / (correct + mistakes) * 100) : 100;
  const wpm = Math.round((correct / 5) / Math.max(1 / 60, time / 60));
  const timeLabel = `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;

  useEffect(() => { scoreRef.current = score; }, [score]);

  const finish = useCallback(() => {
    setStatus("over");
    setRecord((old) => {
      const next = Math.max(old, scoreRef.current);
      localStorage.setItem("vibetyping-record", String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => setTime((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status, finish]);

  const start = () => {
    setTarget(makeTarget(level)); setIndex(0); setTime(0); setScore(0); setCombo(0);
    setBestCombo(0); setCorrect(0); setMistakes(0); setStatus("playing");
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const chooseLevel = (item: Level) => {
    setLevel(item); setTarget(makeTarget(item)); setIndex(0);
    if (status === "playing" || status === "paused") {
      setTime(0); setScore(0); setCombo(0); setBestCombo(0); setCorrect(0); setMistakes(0); setStatus("playing");
    }
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const hitKey = (key: string) => {
    if (status !== "playing" || key.length !== 1) return;
    if (key === target[index]) {
      playSound("key");
      const nextCombo = combo + 1;
      setCorrect((v) => v + 1); setCombo(nextCombo); setBestCombo((v) => Math.max(v, nextCombo));
      setScore((v) => v + 10 + Math.min(40, Math.floor(nextCombo / 5) * 2));
      setFlash("good");
      if (index + 1 >= target.length) { setTarget(makeTarget(level)); setIndex(0); }
      else setIndex((v) => v + 1);
    } else {
      playSound("error");
      setMistakes((v) => v + 1); setCombo(0); setScore((v) => Math.max(0, v - 5)); setFlash("bad");
    }
    window.setTimeout(() => setFlash(""), 110);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Escape" && (status === "playing" || status === "paused")) {
        setStatus((s) => s === "playing" ? "paused" : "playing"); return;
      }
      // The hidden input handles focused keyboard input through onChange.
      // Skipping its keydown prevents one physical key from being scored twice.
      if (e.target === inputRef.current) return;
      if (status === "playing") { e.preventDefault(); hitKey(e.key); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const chars = useMemo(() => target.split(""), [target]);
  const nextKey = target[index] || " ";
  const activeKey = keyBase(nextKey);
  const activeFinger = fingerFor(nextKey);

  return (
    <main className={`app ${flash}`} onClick={() => inputRef.current?.focus()}>
      <input ref={inputRef} className="key-catcher" inputMode="text" aria-label="Typing input"
        onChange={(e) => { const value = e.target.value; if (value) hitKey(value.at(-1)!); e.target.value = ""; }} />

      <header className="topbar">
        <a className="brand" href="#" aria-label="VibeTyping home"><span className="brand-mark">VT</span><span>VIBETYPING<small>KEYBOARD ADVENTURE</small></span></a>
        <div className="record"><span>PERSONAL BEST</span><strong>{record.toLocaleString()}</strong><i>PTS</i></div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span /> OPEN-ENDED PRACTICE SESSION <span /></div>
        <h1>Fingers ready. <em>Game on.</em></h1>
        <p>Letters × numbers × symbols. Stay accurate, build your combo, and make every keystroke count.</p>
      </section>

      <section className="game-shell" aria-label="Typing game">
        <div className="hud">
          <div className="stat"><span>ELAPSED</span><strong>{timeLabel}</strong></div>
          <div className="stat"><span>SCORE</span><strong>{score.toLocaleString()}</strong></div>
          <div className="stat combo"><span>COMBO</span><strong>×{combo}</strong></div>
          <div className="mistake-stat" aria-label={`${mistakes} mistakes`}><span>MISTAKES</span><strong>{mistakes}</strong></div>
        </div>
        <nav className="practice-bar" aria-label="Practice modules">
          <span className="practice-label">WARM-UP</span>
          {(["LETTERS","NUMBERS","SYMBOLS"] as Level[]).map((item) => <button key={item} onClick={() => chooseLevel(item)} className={level === item ? "selected" : ""}>{item}</button>)}
          <i /><span className="practice-label">CHALLENGE</span>
          {(["RUSH","EXTREME"] as Level[]).map((item) => <button key={item} onClick={() => chooseLevel(item)} className={level === item ? "selected" : ""}>{item === "RUSH" ? "FULL MIX" : item}</button>)}
        </nav>

        <div className="arena">
          <div className="grid-lines" />
          {status === "ready" && <div className="overlay intro">
            <span className="round-badge">01</span><h2>Choose your practice</h2><p>Start with one key family or jump into a mixed challenge. Mistakes guide you and practice never stops.</p>
            <button className="start-button" onClick={start}><span>START CHALLENGE</span><kbd>ENTER</kbd></button>
          </div>}

          {(status === "playing" || status === "paused") && <div className="playfield">
            <div className="mission"><span>CURRENT MISSION</span><i>{level} MODE</i></div>
            <div className="target" aria-live="polite">{chars.map((char, i) => <span key={`${target}-${i}`} className={i < index ? "done" : i === index ? "current" : "pending"}>{char === " " ? "·" : char}</span>)}</div>
            <div className="progress"><i style={{width: `${index / target.length * 100}%`}} /></div>
            <div className="next-key">NEXT KEY <kbd>{nextKey === " " ? "SPACE" : nextKey}</kbd><span>{activeFinger}</span></div>
            <div className="keyboard-guide" aria-label="Keyboard finger guide">
              {KEY_ROWS.map((row, rowIndex) => <div className="key-row" key={rowIndex}>{row.split("").map((key) => <span key={key} className={`guide-key${key === " " ? " wide" : ""}${key === activeKey ? " active" : ""}`}>{key === " " ? "SPACE" : key.toUpperCase()}</span>)}</div>)}
              <div className="finger-legend">{FINGERS.map((finger) => <span key={finger} className={finger === activeFinger ? "active" : ""}>{finger}</span>)}</div>
            </div>
            <button className="end-button" onClick={finish}>END SESSION</button>
          </div>}

          {status === "paused" && <div className="pause-screen"><span>PAUSED</span><h2>Take a breath</h2><button onClick={() => setStatus("playing")}>RESUME GAME</button></div>}

          {status === "over" && <div className="overlay result"><span className="result-label">RUN COMPLETE</span><h2>{score.toLocaleString()} <small>PTS</small></h2><div className="result-grid"><div><strong>{wpm}</strong><span>WPM</span></div><div><strong>{accuracy}%</strong><span>ACCURACY</span></div><div><strong>×{bestCombo}</strong><span>BEST COMBO</span></div></div><button className="start-button" onClick={start}><span>PLAY AGAIN</span><kbd>↵</kbd></button></div>}
        </div>

        <div className="game-footer"><span><kbd>ESC</kbd> PAUSE / RESUME</span><span>ACCURACY <b>{accuracy}%</b></span><span>SPEED <b>{wpm} WPM</b></span></div>
      </section>

      <footer><span>VIBETYPING / 2026</span><p>SLOW IS SMOOTH. SMOOTH IS FAST.</p><span>LEVEL: {level}</span></footer>
    </main>
  );
}
