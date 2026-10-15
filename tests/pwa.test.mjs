import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function worker(fetchImpl, cached) {
  const handlers = {}, deleted = [], saved = [], pending = [];
  vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self: { location: { origin: "https://longitude.test" }, addEventListener: (name, fn) => handlers[name] = fn, clients: { claim: async () => {} } },
    caches: { keys: async () => ["other-app", "longitude-geo-v72-4", "longitude-geo-v74-1-3-cache-2", "longitude-geo-v74-1-3-rc4-cache-3"], delete: async key => deleted.push(key), match: async () => cached, open: async () => ({ put: async (...args) => saved.push(args) }) },
    fetch: fetchImpl, URL, Response,
  });
  return { handlers, deleted, saved, pending, event: { request: { method: "GET", mode: "navigate", url: "https://longitude.test/" }, waitUntil: p => pending.push(p) } };
}

test("PWA remove somente caches antigos do Longitude", async () => {
  const w = worker();
  w.handlers.activate(w.event);
  await Promise.all(w.pending);
  assert.deepEqual(w.deleted, ["longitude-geo-v72-4", "longitude-geo-v74-1-3-cache-2"]);
});
test("PWA não substitui shell offline por erro HTTP ou JSON", async () => {
  for (const response of [new Response("erro", { status: 500 }), new Response("{}", { headers: { "content-type": "application/json" } })]) {
    const w = worker(async () => response);
    let result;
    w.handlers.fetch({ ...w.event, respondWith: p => result = p });
    assert.equal(await result, response);
    await Promise.all(w.pending);
    assert.equal(w.saved.length, 0);
  }
});
test("PWA guarda HTML válido e aguarda escrita", async () => {
  const w = worker(async () => new Response("<html></html>", { headers: { "content-type": "text/html" } }));
  let result;
  w.handlers.fetch({ ...w.event, respondWith: p => result = p });
  await result;
  await Promise.all(w.pending);
  assert.equal(w.saved.length, 1);
});
test("PWA offline retorna shell ou resposta 503 sem cache", async () => {
  for (const cached of [undefined, new Response("shell")]) {
    const w = worker(async () => { throw new Error("offline"); }, cached);
    let result;
    w.handlers.fetch({ ...w.event, respondWith: p => result = p });
    const response = await result;
    assert.equal(response.status, cached ? 200 : 503);
  }
});
