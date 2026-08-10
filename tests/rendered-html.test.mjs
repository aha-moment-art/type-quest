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
  assert.match(html, />IELTS<\/button>/);
  assert.match(html, />TOEFL<\/button>/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("ships complete, locally hosted vocabulary audio", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const section = page.slice(page.indexOf("const VOCABULARY"), page.indexOf("} as const;"));
  const words = [...new Set([...section.matchAll(/\["([a-z-]+)",/g)].map((match) => match[1]))];
  const audioRoot = new URL("../public/audio/words/", import.meta.url);
  const files = (await readdir(audioRoot)).filter((file) => file.endsWith(".mp3"));
  assert.equal(words.length, 71);
  assert.equal(files.length, words.length);
  await Promise.all(words.map((word) => access(new URL(`${word}.mp3`, audioRoot))));
  assert.match(page, /new Audio\(`\/audio\/words\//);
  assert.match(page, /英式 AI 发音/);
  assert.match(page, /自动朗读：开/);
});
