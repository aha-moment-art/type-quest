import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the VibeTyping vocabulary app", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>VibeTyping \| 打字背单词<\/title>/i);
  assert.match(html, /Type it\. <em>Remember it\.<\/em>/);
  assert.match(html, /12,217 WORDS · 11,871 SENTENCES/);
  assert.match(html, />VOCABULARY<\/button>/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("ships complete WordLeap dictionaries and locally hosted audio", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const wordFiles = (await readdir(new URL("../public/audio/words/", import.meta.url))).filter((file) => file.endsWith(".mp3"));
  const sentenceFiles = (await readdir(new URL("../public/audio/sentences/", import.meta.url))).filter((file) => file.endsWith(".mp3"));
  assert.equal(wordFiles.length, 12217);
  assert.equal(sentenceFiles.length, 11871);
  await Promise.all(["CET-4", "CET-6", "IELTS", "TOEFL", "PTE", "TEM-4", "TEM-8", "custom-examples"].map((name) => access(new URL(`../public/dicts/${name}.json`, import.meta.url))));
  assert.match(page, /audio\/words/);
  assert.match(page, /audio\/sentences/);
  assert.match(page, /英式 AI 发音/);
  assert.match(page, /每遍朗读：开/);
  assert.match(page, /currentItem\.audioId}:\$\{currentRepeat/);
  assert.match(page, /currentItem, currentRepeat, level, playEntry/);
  assert.match(page, /function nextTypingIndex/);
  assert.match(page, /isRepeatSeparator \? nextIndex \+ 1 : nextIndex/);
  assert.match(page, /vocab-word-target/);
  assert.match(styles, /--font-geist-mono:ui-monospace/);
  assert.match(styles, /\.word-card h2[^}]*clamp\(44px,6vw,64px\)/);
  assert.match(styles, /\.target\.vocab-word-target[^}]*clamp\(30px,4vw,44px\)/);
});
