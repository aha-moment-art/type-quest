const WORDS = ["flux","orbit","pixel","nova","shift","vector","quick","blaze","echo","glitch","tempo","laser"];
const SYMBOLS = ["!","?","@","#","$","%","&","*","+","-","=",":",";","/","_",".",","];
const $ = (id) => document.getElementById(id);
let level="RUSH", state="ready", target="", index=0, time=60, score=0, combo=0, bestCombo=0, correct=0, mistakes=0, lives=3, timer;

function makeTarget(){
  const groups=level==="WARM UP"?4:level==="RUSH"?6:8;
  return Array.from({length:groups},(_,i)=>{
    let word=WORDS[Math.floor(Math.random()*WORDS.length)];
    const number=Math.floor(Math.random()*(level==="WARM UP"?90:900))+10;
    const symbol=SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
    if(level==="WARM UP") return i%2?`${number}${symbol}`:word;
    if(level==="RUSH") return i%2?`${word}${symbol}${number}`:`${number}${symbol}${word}`;
    word=[...word].map(c=>Math.random()>.62?c.toUpperCase():c).join("");
    return i%2?`${symbol}${word}_${number}`:`${number}${symbol}${word}`;
  }).join(" ");
}
function stats(){
  const accuracy=correct+mistakes?Math.round(correct/(correct+mistakes)*100):100;
  const wpm=Math.round((correct/5)/Math.max(1/60,(60-time)/60));
  $("time").textContent=String(time).padStart(2,"0"); $("score").textContent=score.toLocaleString(); $("combo").textContent=combo;
  $("accuracy").textContent=`${accuracy}%`; $("wpm").textContent=`${wpm} WPM`;
  $("lives").innerHTML=[0,1,2].map(n=>`<span class="${n<lives?"alive":""}">♥</span>`).join("");
  $("lives").setAttribute("aria-label",`${lives} lives remaining`);
  return {accuracy,wpm};
}
function renderTarget(){
  $("target").innerHTML=[...target].map((c,i)=>`<span class="${i<index?"done":i===index?"current":"pending"}">${c===" "?"·":c}</span>`).join("");
  $("progress").style.width=`${index/target.length*100}%`; $("next-key").textContent=target[index]===" "?"SPACE":target[index];
}
function start(){
  clearInterval(timer); target=makeTarget(); index=0; time=60; score=0; combo=0; bestCombo=0; correct=0; mistakes=0; lives=3; state="playing";
  $("ready").classList.add("hidden"); $("result").classList.add("hidden"); $("pause").classList.add("hidden"); $("playfield").classList.remove("hidden");
  $("mode").textContent=`${level} MODE`; renderTarget(); stats();
  timer=setInterval(()=>{time--; stats(); if(time<=0) finish();},1000);
}
function finish(){
  if(state==="over") return; clearInterval(timer); state="over"; const s=stats();
  const record=Math.max(Number(localStorage.getItem("vibetyping-record")||0),score); localStorage.setItem("vibetyping-record",record); $("record").textContent=record.toLocaleString();
  $("playfield").classList.add("hidden"); $("pause").classList.add("hidden"); $("result").classList.remove("hidden");
  $("final-score").textContent=score.toLocaleString(); $("final-wpm").textContent=s.wpm; $("final-accuracy").textContent=`${s.accuracy}%`; $("final-combo").textContent=`×${bestCombo}`;
}
function hit(key){
  if(state!=="playing"||key.length!==1)return;
  if(key===target[index]){combo++;bestCombo=Math.max(bestCombo,combo);correct++;score+=10+Math.min(40,Math.floor(combo/5)*2);index++;document.body.classList.add("good");if(index>=target.length){target=makeTarget();index=0;lives=Math.min(3,lives+1);} }
  else{mistakes++;combo=0;score=Math.max(0,score-5);lives--;document.body.classList.add("bad");if(lives<=0)finish();}
  setTimeout(()=>document.body.classList.remove("good","bad"),120);renderTarget();stats();
}
document.querySelectorAll("[data-level]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-level]").forEach(b=>b.classList.remove("selected"));button.classList.add("selected");level=button.dataset.level;$("footer-level").textContent=level;}));
$("start").addEventListener("click",start); $("again").addEventListener("click",start); $("resume").addEventListener("click",()=>{state="playing";$("pause").classList.add("hidden");});
window.addEventListener("keydown",e=>{if(e.repeat)return;if(e.key==="Enter"&&(state==="ready"||state==="over")){start();return;}if(e.key==="Escape"&&(state==="playing"||state==="paused")){state=state==="playing"?"paused":"playing";$("pause").classList.toggle("hidden",state!=="paused");return;}if(state==="playing"){e.preventDefault();hit(e.key);}});
$("record").textContent=Number(localStorage.getItem("vibetyping-record")||0).toLocaleString();stats();
