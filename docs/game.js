const WORDS = ["flux","orbit","pixel","nova","shift","vector","quick","blaze","echo","glitch","tempo","laser"];
const SYMBOLS = ["!","?","@","#","$","%","&","*","+","-","=",":",";","/","_",".",","];
const KEY_ROWS = ["1234567890-=","qwertyuiop[]\\","asdfghjkl;'","zxcvbnm,./"," "];
const SHIFT_BASE = {"!":"1","@":"2","#":"3","$":"4","%":"5","^":"6","&":"7","*":"8","(":"9",")":"0","_":"-","+":"=","{":"[","}":"]","|":"\\",":":";","\"":"'","<":",",">":".","?":"/"};
const FINGER_KEYS = {
  "LEFT PINKY":"`1qaz", "LEFT RING":"2wsx", "LEFT MIDDLE":"3edc", "LEFT INDEX":"45rtfgvb",
  "RIGHT INDEX":"67yuhjnm", "RIGHT MIDDLE":"8ik,", "RIGHT RING":"9ol.", "RIGHT PINKY":"0-=p[]\\;'/", "THUMB":" "
};
const FINGERS = Object.keys(FINGER_KEYS);
const LEFT_FINGERS = ["LEFT PINKY","LEFT RING","LEFT MIDDLE","LEFT INDEX","THUMB"];
const RIGHT_FINGERS = ["THUMB","RIGHT INDEX","RIGHT MIDDLE","RIGHT RING","RIGHT PINKY"];
const $ = (id) => document.getElementById(id);
let level="RUSH", state="ready", target="", index=0, time=0, score=0, combo=0, bestCombo=0, correct=0, mistakes=0, timer;
let audioContext;

function keyBase(key){return (SHIFT_BASE[key]||key).toLowerCase();}
function fingerFor(key){const base=keyBase(key);return FINGERS.find(name=>FINGER_KEYS[name].includes(base))||"RIGHT PINKY";}
function sound(kind){
  audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
  if(audioContext.state==="suspended") audioContext.resume();
  const now=audioContext.currentTime;
  if(kind==="error"){
    [0,0.09].forEach((delay,i)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type="square";osc.frequency.value=i?145:190;gain.gain.setValueAtTime(.07,now+delay);gain.gain.exponentialRampToValueAtTime(.001,now+delay+.08);osc.connect(gain).connect(audioContext.destination);osc.start(now+delay);osc.stop(now+delay+.09);});
    return;
  }
  const length=Math.floor(audioContext.sampleRate*.025),buffer=audioContext.createBuffer(1,length,audioContext.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++) data[i]=(Math.random()*2-1)*(1-i/length);
  const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain();source.buffer=buffer;filter.type="highpass";filter.frequency.value=900;gain.gain.value=.12;source.connect(filter).connect(gain).connect(audioContext.destination);source.start(now);
}

function renderKeyboard(){
  const active=keyBase(target[index]||" "), finger=fingerFor(target[index]||" ");
  const hand=(side,names)=>`<div class="hand ${side}"><div class="palm"><b>${side.toUpperCase()} HAND</b></div>${names.map((name,i)=>`<span class="finger finger-${i+1}${name===finger?" active":""}" title="${name}"><i>${name.includes("PINKY")?"P":name.includes("RING")?"R":name.includes("MIDDLE")?"M":name.includes("INDEX")?"I":"T"}</i></span>`).join("")}</div>`;
  $("keyboard-guide").innerHTML=`<div class="keyboard-case">${KEY_ROWS.map((row,rowIndex)=>`<div class="key-row row-${rowIndex+1}">${[...row].map(key=>`<span class="guide-key${key===" "?" wide":""}${key===active?" active":""}">${key===" "?"SPACE":key.toUpperCase()}</span>`).join("")}</div>`).join("")}</div><div class="hands-layer">${hand("left",LEFT_FINGERS)}${hand("right",RIGHT_FINGERS)}</div>`;
  $("finger-name").textContent=finger;
}

function makeTarget(){
  if(level==="LETTERS") return Array.from({length:8},()=>WORDS[Math.floor(Math.random()*WORDS.length)]).join(" ");
  if(level==="NUMBERS") return Array.from({length:10},()=>String(Math.floor(Math.random()*900)+10)).join(" ");
  if(level==="SYMBOLS") return Array.from({length:12},()=>SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)]).join(" ");
  const groups=level==="RUSH"?6:8;
  return Array.from({length:groups},(_,i)=>{
    let word=WORDS[Math.floor(Math.random()*WORDS.length)];
    const number=Math.floor(Math.random()*900)+10;
    const symbol=SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
    if(level==="RUSH") return i%2?`${word}${symbol}${number}`:`${number}${symbol}${word}`;
    word=[...word].map(c=>Math.random()>.62?c.toUpperCase():c).join("");
    return i%2?`${symbol}${word}_${number}`:`${number}${symbol}${word}`;
  }).join(" ");
}
function stats(){
  const accuracy=correct+mistakes?Math.round(correct/(correct+mistakes)*100):100;
  const wpm=Math.round((correct/5)/Math.max(1/60,time/60));
  $("time").textContent=`${String(Math.floor(time/60)).padStart(2,"0")}:${String(time%60).padStart(2,"0")}`; $("score").textContent=score.toLocaleString(); $("combo").textContent=combo;
  $("accuracy").textContent=`${accuracy}%`; $("wpm").textContent=`${wpm} WPM`;
  $("mistake-count").textContent=mistakes;
  $("mistake-count").parentElement.setAttribute("aria-label",`${mistakes} mistakes`);
  return {accuracy,wpm};
}
function runTimer(){
  clearInterval(timer);
  timer=setInterval(()=>{time++;stats();},1000);
}
function pauseGame(){
  if(state!=="playing") return;
  clearInterval(timer); state="paused"; $("pause").classList.remove("hidden");
}
function resumeGame(){
  if(state!=="paused") return;
  state="playing"; $("pause").classList.add("hidden"); runTimer();
}
function renderTarget(){
  $("target").innerHTML=[...target].map((c,i)=>`<span class="${i<index?"done":i===index?"current":"pending"}">${c===" "?"·":c}</span>`).join("");
  $("progress").style.width=`${index/target.length*100}%`; $("next-key").textContent=target[index]===" "?"SPACE":target[index];
  renderKeyboard();
}
function start(){
  clearInterval(timer); target=makeTarget(); index=0; time=0; score=0; combo=0; bestCombo=0; correct=0; mistakes=0; state="playing";
  $("ready").classList.add("hidden"); $("result").classList.add("hidden"); $("pause").classList.add("hidden"); $("playfield").classList.remove("hidden");
  $("mode").textContent=`${level} MODE`; renderTarget(); stats();
  runTimer();
}
function finish(){
  if(state==="over") return; clearInterval(timer); state="over"; const s=stats();
  const record=Math.max(Number(localStorage.getItem("vibetyping-record")||0),score); localStorage.setItem("vibetyping-record",record); $("record").textContent=record.toLocaleString();
  $("playfield").classList.add("hidden"); $("pause").classList.add("hidden"); $("result").classList.remove("hidden");
  $("final-score").textContent=score.toLocaleString(); $("final-wpm").textContent=s.wpm; $("final-accuracy").textContent=`${s.accuracy}%`; $("final-combo").textContent=`×${bestCombo}`;
}
function hit(key){
  if(state!=="playing"||key.length!==1)return;
  if(key===target[index]){sound("key");combo++;bestCombo=Math.max(bestCombo,combo);correct++;score+=10+Math.min(40,Math.floor(combo/5)*2);index++;document.body.classList.add("good");if(index>=target.length){target=makeTarget();index=0;} }
  else{sound("error");mistakes++;combo=0;score=Math.max(0,score-5);document.body.classList.add("bad");}
  setTimeout(()=>document.body.classList.remove("good","bad"),120);renderTarget();stats();
}
document.querySelectorAll("[data-level]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-level]").forEach(b=>b.classList.toggle("selected",b.dataset.level===button.dataset.level));level=button.dataset.level;$("footer-level").textContent=level;if(state==="playing"||state==="paused")start();}));
$("start").addEventListener("click",start); $("again").addEventListener("click",start); $("end-session").addEventListener("click",finish); $("resume").addEventListener("click",resumeGame);
window.addEventListener("keydown",e=>{if(e.repeat)return;if(e.key==="Enter"&&(state==="ready"||state==="over")){start();return;}if(e.key==="Escape"&&state==="playing"){pauseGame();return;}if(e.key==="Escape"&&state==="paused"){resumeGame();return;}if(state==="playing"){e.preventDefault();hit(e.key);}});
$("record").textContent=Number(localStorage.getItem("vibetyping-record")||0).toLocaleString();stats();
