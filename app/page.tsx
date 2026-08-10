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
const LEFT_FINGERS = ["LEFT PINKY", "LEFT RING", "LEFT MIDDLE", "LEFT INDEX", "THUMB"];
const RIGHT_FINGERS = ["THUMB", "RIGHT INDEX", "RIGHT MIDDLE", "RIGHT RING", "RIGHT PINKY"];
const LIBRARIES = ["ALL", "CET-4", "CET-6", "IELTS", "TOEFL", "PTE", "TEM-4", "TEM-8"] as const;
const DICTIONARIES = LIBRARIES.filter((name) => name !== "ALL");

type BaseLevel = "LETTERS" | "NUMBERS" | "SYMBOLS" | "RUSH" | "EXTREME";
type Level = BaseLevel | "VOCAB";
type Library = typeof LIBRARIES[number];
type VocabMode = "WORD" | "SENTENCE";
type GameState = "ready" | "playing" | "paused" | "over";
type RawEntry = { word: string; phonetic?: string; meaning?: string; example?: string; exampleSourceId?: number; exampleSourceUser?: string };
type CustomExample = { word: string; example: string; audioId: string };
type PracticeEntry = { word: string; phonetic: string; meaning: string; text: string; audioId: string; sourceId?: number; sourceUser?: string };
let audioContext: AudioContext | null = null;

function keyBase(key: string) { return (SHIFT_BASE[key] || key).toLowerCase(); }
function fingerFor(key: string) { const base = keyBase(key); return FINGERS.find((name) => FINGER_KEYS[name].includes(base)) || "RIGHT PINKY"; }
function needsShift(key: string) { return /^[A-Z]$/.test(key) || Object.hasOwn(SHIFT_BASE, key); }
function levelName(level: Level) { return level === "RUSH" ? "FULL MIX" : level === "VOCAB" ? "VOCABULARY" : level; }
function readRecord() { try { return Number(localStorage.getItem("vibetyping-record") || 0); } catch { return 0; } }
function writeRecord(value: number) { try { localStorage.setItem("vibetyping-record", String(value)); } catch {} }
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

function HandGuide({ side, names, activeFingers }: { side: "left" | "right"; names: string[]; activeFingers: string[] }) {
  const initial = (name: string) => name.includes("PINKY") ? "P" : name.includes("RING") ? "R" : name.includes("MIDDLE") ? "M" : name.includes("INDEX") ? "I" : "T";
  return <div className={`hand ${side}`}><div className="palm"><b>{side.toUpperCase()} HAND</b></div>{names.map((name, i) => <span key={name} className={`finger finger-${i + 1}${activeFingers.includes(name) ? " active" : ""}`} title={name}><i>{initial(name)}</i></span>)}</div>;
}

function makeBaseTarget(level: BaseLevel) {
  if (level === "LETTERS") return Array.from({ length: 8 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(" ");
  if (level === "NUMBERS") return Array.from({ length: 10 }, () => String(Math.floor(Math.random() * 900) + 10)).join(" ");
  if (level === "SYMBOLS") return Array.from({ length: 12 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]).join(" ");
  const groups = level === "RUSH" ? 6 : 8;
  return Array.from({ length: groups }, (_, i) => {
    const word = LETTERS[Math.floor(Math.random() * LETTERS.length)]; const number = Math.floor(Math.random() * 900) + 10; const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    if (level === "RUSH") return i % 2 ? `${word}${symbol}${number}` : `${number}${symbol}${word}`;
    const upper = word.split("").map((c) => Math.random() > .62 ? c.toUpperCase() : c).join("");
    return i % 2 ? `${symbol}${upper}_${number}` : `${number}${symbol}${upper}`;
  }).join(" ");
}

async function loadPracticeEntries(library: Library, mode: VocabMode, signal: AbortSignal) {
  const names = library === "ALL" ? DICTIONARIES : [library];
  const [rawLibraries, customExamples] = await Promise.all([
    Promise.all(names.map(async (name) => {
      const response = await fetch(`/dicts/${name}.json`, { signal });
      if (!response.ok) throw new Error(`无法加载 ${name}`);
      return response.json() as Promise<RawEntry[]>;
    })),
    fetch("/dicts/custom-examples.json", { signal }).then((response) => response.json() as Promise<CustomExample[]>),
  ]);
  const raw = rawLibraries.flat();
  const words = new Map<string, RawEntry>();
  for (const entry of raw) if (entry.word) words.set(entry.word.toLocaleLowerCase(), words.get(entry.word.toLocaleLowerCase()) || entry);
  if (mode === "WORD") return [...words.values()].map((entry) => ({ word: entry.word, phonetic: entry.phonetic || "", meaning: entry.meaning || "", text: entry.word, audioId: entry.word }));
  const sentences = new Map<string, PracticeEntry>();
  for (const entry of raw) if (entry.example && entry.exampleSourceId) sentences.set(String(entry.exampleSourceId), { word: entry.word, phonetic: entry.phonetic || "", meaning: entry.meaning || "", text: entry.example, audioId: String(entry.exampleSourceId), sourceId: entry.exampleSourceId, sourceUser: entry.exampleSourceUser });
  for (const custom of customExamples) {
    const entry = words.get(custom.word.toLocaleLowerCase());
    if (entry && custom.example && custom.audioId) sentences.set(custom.audioId, { word: entry.word, phonetic: entry.phonetic || "", meaning: entry.meaning || "", text: custom.example, audioId: custom.audioId });
  }
  return [...sentences.values()];
}

export default function Home() {
  const [level, setLevel] = useState<Level>("RUSH");
  const [status, setStatus] = useState<GameState>("ready");
  const [target, setTarget] = useState(() => makeBaseTarget("RUSH"));
  const [index, setIndex] = useState(0);
  const [time, setTime] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [flash, setFlash] = useState<"good" | "bad" | "">("");
  const [record, setRecord] = useState(0);
  const [repetitions, setRepetitions] = useState(3);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [library, setLibrary] = useState<Library>("IELTS");
  const [vocabMode, setVocabMode] = useState<VocabMode>("WORD");
  const [entries, setEntries] = useState<PracticeEntry[]>([]);
  const [currentItem, setCurrentItem] = useState<PracticeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);
  const scoreRef = useRef(0);
  const flashTimerRef = useRef<number | null>(null);

  useEffect(() => { const frame = requestAnimationFrame(() => setRecord(readRecord())); return () => cancelAnimationFrame(frame); }, []);
  useEffect(() => { scoreRef.current = score; }, [score]);

  useEffect(() => {
    if (level !== "VOCAB") return;
    const controller = new AbortController(); setLoading(true); setLoadError(""); setEntries([]); setCurrentItem(null);
    loadPracticeEntries(library, vocabMode, controller.signal).then((loaded) => {
      setEntries(loaded); const first = loaded[Math.floor(Math.random() * loaded.length)] || null; setCurrentItem(first); if (first) setTarget(Array.from({ length: repetitions }, () => first.text).join(" "));
    }).catch((error) => { if (error.name !== "AbortError") setLoadError(error.message || "词库加载失败"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [level, library, vocabMode, repetitions]);

  const accuracy = correct + mistakes ? Math.round(correct / (correct + mistakes) * 100) : 100;
  const wpm = Math.round((correct / 5) / Math.max(1 / 60, time / 60));
  const timeLabel = `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
  const currentText = currentItem?.text || "";
  const currentRepeat = level === "VOCAB" && currentText ? Math.min(repetitions, Math.floor(index / (currentText.length + 1)) + 1) : 0;

  const playEntry = useCallback((entry: PracticeEntry | null) => {
    if (!entry) return; wordAudioRef.current?.pause();
    const path = vocabMode === "WORD" ? `/audio/words/${encodeURIComponent(entry.audioId)}.mp3` : `/audio/sentences/${encodeURIComponent(entry.audioId)}.mp3`;
    const audio = new Audio(path); wordAudioRef.current = audio; void audio.play().catch(() => {});
  }, [vocabMode]);

  useEffect(() => {
    if (status !== "playing" || level !== "VOCAB" || !audioEnabled || !currentItem) return;
    playEntry(currentItem); return () => wordAudioRef.current?.pause();
  }, [audioEnabled, currentItem, level, playEntry, status]);

  const finish = useCallback(() => { setStatus("over"); setRecord((old) => { const next = Math.max(old, scoreRef.current); writeRecord(next); return next; }); }, []);
  useEffect(() => { if (status !== "playing") return; const timer = window.setInterval(() => setTime((t) => t + 1), 1000); return () => window.clearInterval(timer); }, [status]);

  const resetStats = () => { setIndex(0); setTime(0); setScore(0); setCombo(0); setBestCombo(0); setCorrect(0); setMistakes(0); setWordsCompleted(0); };
  const chooseEntry = (previous?: PracticeEntry | null) => {
    const choices = entries.length > 1 && previous ? entries.filter((entry) => entry.audioId !== previous.audioId) : entries;
    const next = choices[Math.floor(Math.random() * choices.length)] || null; setCurrentItem(next); if (next) setTarget(Array.from({ length: repetitions }, () => next.text).join(" ")); return next;
  };
  const start = () => {
    resetStats();
    if (level === "VOCAB") { if (!entries.length) return; chooseEntry(currentItem); } else setTarget(makeBaseTarget(level as BaseLevel));
    setStatus("playing"); setTimeout(() => inputRef.current?.focus(), 30);
  };
  const chooseLevel = (item: Level) => {
    setLevel(item); resetStats(); if (item !== "VOCAB") setTarget(makeBaseTarget(item as BaseLevel));
    if (status === "playing" || status === "paused") setStatus(item === "VOCAB" && !entries.length ? "ready" : "playing");
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const hitKey = (key: string) => {
    if (status !== "playing" || key.length !== 1) return;
    if (key === target[index]) {
      playSound("key"); const nextCombo = combo + 1; setCorrect((v) => v + 1); setCombo(nextCombo); setBestCombo((v) => Math.max(v, nextCombo)); setScore((v) => v + 10 + Math.min(40, Math.floor(nextCombo / 5) * 2)); setFlash("good");
      if (index + 1 >= target.length) { if (level === "VOCAB") { setWordsCompleted((v) => v + 1); chooseEntry(currentItem); } else setTarget(makeBaseTarget(level as BaseLevel)); setIndex(0); } else setIndex((v) => v + 1);
    } else { playSound("error"); setMistakes((v) => v + 1); setCombo(0); setScore((v) => Math.max(0, v - 5)); setFlash("bad"); }
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current); flashTimerRef.current = window.setTimeout(() => setFlash(""), 110);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.repeat) return; if (e.key === "Escape" && (status === "playing" || status === "paused")) { setStatus((s) => s === "playing" ? "paused" : "playing"); return; } if (e.target === inputRef.current) return; if (status === "playing") { e.preventDefault(); hitKey(e.key); } };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  });

  const chars = useMemo(() => target.split(""), [target]);
  const nextKey = target[index] || " "; const activeKey = keyBase(nextKey); const activeFinger = fingerFor(nextKey); const shiftRequired = needsShift(nextKey); const shiftSide = activeFinger.startsWith("LEFT") ? "RIGHT" : "LEFT";
  const activeFingers = [activeFinger, ...(shiftRequired ? [`${shiftSide} PINKY`] : [])]; const fingerLabel = shiftRequired ? `${activeFinger} + ${shiftSide} PINKY (SHIFT)` : activeFinger;

  return <main className={`app ${flash}`} onClick={() => inputRef.current?.focus()}>
    <input ref={inputRef} className="key-catcher" inputMode="text" aria-label="Typing input" onChange={(e) => { const value = e.target.value; if (value) hitKey(value.at(-1)!); e.target.value = ""; }} />
    <header className="topbar"><a className="brand" href="#" aria-label="VibeTyping home"><span className="brand-mark">VT</span><span>VIBETYPING<small>TYPE · REPEAT · REMEMBER</small></span></a><div className="record"><span>PERSONAL BEST</span><strong>{record.toLocaleString()}</strong><i>PTS</i></div></header>
    <section className="hero"><div className="eyebrow"><span /> 12,217 WORDS · 11,871 SENTENCES <span /></div><h1>Type it. <em>Remember it.</em></h1><p>七套完整词库，单词与例句都能通过重复输入强化记忆。</p></section>
    <section className="game-shell" aria-label="Typing game">
      <div className="hud"><div className="stat"><span>ELAPSED</span><strong>{timeLabel}</strong></div><div className="stat"><span>SCORE</span><strong>{score.toLocaleString()}</strong></div><div className="stat combo"><span>COMBO</span><strong>×{combo}</strong></div><div className="mistake-stat" aria-label={`${mistakes} mistakes`}><span>MISTAKES</span><strong>{mistakes}</strong></div></div>
      <nav className="practice-bar" aria-label="Practice modules"><span className="practice-label">WARM-UP</span>{(["LETTERS","NUMBERS","SYMBOLS"] as Level[]).map((item) => <button key={item} onClick={() => chooseLevel(item)} className={level === item ? "selected" : ""}>{item}</button>)}<i /><span className="practice-label">CHALLENGE</span>{(["RUSH","EXTREME"] as Level[]).map((item) => <button key={item} onClick={() => chooseLevel(item)} className={level === item ? "selected" : ""}>{item === "RUSH" ? "FULL MIX" : item}</button>)}<i /><button onClick={() => chooseLevel("VOCAB")} className={level === "VOCAB" ? "selected vocab-tab" : "vocab-tab"}>VOCABULARY</button></nav>
      <div className="arena"><div className="grid-lines" />
        {status === "ready" && <div className="overlay intro"><span className="round-badge">01</span><h2>{level === "VOCAB" ? "完整词库打字背诵" : "Choose your practice"}</h2><p>{level === "VOCAB" ? "选择词库与练习内容。单词和例句均配有英式 AI 发音。" : "Start with one key family or jump into a mixed challenge. Mistakes guide you and practice never stops."}</p>
          {level === "VOCAB" && <div className="vocab-config"><label>词库<select value={library} onChange={(e) => setLibrary(e.target.value as Library)}>{LIBRARIES.map((name) => <option key={name} value={name}>{name === "ALL" ? "全部词库" : name}</option>)}</select></label><div className="mode-switch"><button className={vocabMode === "WORD" ? "active" : ""} onClick={() => setVocabMode("WORD")}>打单词</button><button className={vocabMode === "SENTENCE" ? "active" : ""} onClick={() => setVocabMode("SENTENCE")}>打句子</button></div><div className="repeat-setting"><label htmlFor="repeat-count">每项输入</label><button onClick={() => setRepetitions((v) => Math.max(1, v - 1))}>−</button><input id="repeat-count" type="number" min="1" max="10" value={repetitions} onChange={(e) => setRepetitions(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} /><button onClick={() => setRepetitions((v) => Math.min(10, v + 1))}>＋</button><span>遍</span></div><p className={loadError ? "library-status error" : "library-status"}>{loading ? "正在加载完整词库…" : loadError || `已载入 ${entries.length.toLocaleString()} ${vocabMode === "WORD" ? "个单词" : "条例句"}`}</p></div>}
          <button className="start-button" onClick={start} disabled={level === "VOCAB" && (loading || !entries.length)}><span>START CHALLENGE</span><kbd>ENTER</kbd></button></div>}
        {(status === "playing" || status === "paused") && <div className="playfield"><div className="mission"><span>CURRENT MISSION</span><i>{level === "VOCAB" ? `${library} · ${vocabMode}` : `${levelName(level)} MODE`}</i></div>
          {level === "VOCAB" && currentItem && <div className={`word-card ${vocabMode === "SENTENCE" ? "sentence-card" : ""}`}><span className="word-level">{library} · {vocabMode === "WORD" ? "WORD" : "SENTENCE"} · 英式 AI 发音</span><div className="word-heading"><h2>{currentItem.word}</h2><button type="button" onClick={(e) => { e.stopPropagation(); playEntry(currentItem); }} aria-label="播放英式发音">🔊</button></div>{currentItem.phonetic && <small>{currentItem.phonetic}</small>}<p>{currentItem.meaning}</p>{vocabMode === "SENTENCE" && currentItem.sourceId && <a className="sentence-source" href={`https://tatoeba.org/en/sentences/show/${currentItem.sourceId}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Tatoeba #{currentItem.sourceId}{currentItem.sourceUser && currentItem.sourceUser !== "\\N" ? ` · ${currentItem.sourceUser}` : ""} · CC BY 2.0 FR</a>}<div className="word-meta"><b>第 {currentRepeat} / {repetitions} 遍</b><span>本轮已完成 {wordsCompleted} 项</span><button type="button" className="audio-toggle" onClick={(e) => { e.stopPropagation(); setAudioEnabled((v) => !v); }}>{audioEnabled ? "自动朗读：开" : "自动朗读：关"}</button></div></div>}
          <div className={`target ${level === "VOCAB" && vocabMode === "SENTENCE" ? "sentence-target" : ""}`} aria-label="Typing target">{chars.map((char, i) => <span key={`${target}-${i}`} className={i < index ? "done" : i === index ? "current" : "pending"}>{char === " " ? "·" : char}</span>)}</div><div className="progress"><i style={{width: `${index / target.length * 100}%`}} /></div><div className="next-key">NEXT KEY <kbd>{nextKey === " " ? "SPACE" : nextKey}</kbd><span>{fingerLabel}</span></div>
          <div className="keyboard-guide" aria-label="Keyboard finger guide"><div className="keyboard-case">{KEY_ROWS.map((row, rowIndex) => rowIndex === 4 ? <div className="key-row row-5 modifier-row" key={rowIndex}><span className={`guide-key shift-key${shiftRequired && shiftSide === "LEFT" ? " active" : ""}`}>SHIFT</span><span className={`guide-key wide${activeKey === " " ? " active" : ""}`}>SPACE</span><span className={`guide-key shift-key${shiftRequired && shiftSide === "RIGHT" ? " active" : ""}`}>SHIFT</span></div> : <div className={`key-row row-${rowIndex + 1}`} key={rowIndex}>{row.split("").map((key) => <span key={key} className={`guide-key${key === activeKey ? " active" : ""}`}>{key.toUpperCase()}</span>)}</div>)}</div><div className="hands-layer"><HandGuide side="left" names={LEFT_FINGERS} activeFingers={activeFingers} /><HandGuide side="right" names={RIGHT_FINGERS} activeFingers={activeFingers} /></div></div><button className="end-button" onClick={finish}>END SESSION</button></div>}
        {status === "paused" && <div className="pause-screen"><span>PAUSED</span><h2>Take a breath</h2><button onClick={() => setStatus("playing")}>RESUME GAME</button></div>}
        {status === "over" && <div className="overlay result"><span className="result-label">RUN COMPLETE</span><h2>{score.toLocaleString()} <small>PTS</small></h2><div className="result-grid"><div><strong>{wpm}</strong><span>WPM</span></div><div><strong>{accuracy}%</strong><span>ACCURACY</span></div><div><strong>×{bestCombo}</strong><span>BEST COMBO</span></div></div><button className="start-button" onClick={start}><span>PLAY AGAIN</span><kbd>↵</kbd></button></div>}
      </div><div className="game-footer"><span><kbd>ESC</kbd> PAUSE / RESUME</span><span>ACCURACY <b>{accuracy}%</b></span><span>SPEED <b>{wpm} WPM</b></span></div>
    </section><footer><span>VIBETYPING / 2026</span><p>TYPE · REPEAT · REMEMBER</p><span>LEVEL: {levelName(level)}</span></footer>
  </main>;
}
