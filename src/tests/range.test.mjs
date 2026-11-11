// Local tests, no network, no Cloudflare account: node --test src/tests/range.test.mjs
// Range (206) for /assets/**.mp4 only, plus a differential check that other routes answer exactly as the
// worker at the base commit (FR_RANGE_BASE, default 44b7cf5) does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
async function load(srcDir) {
  const tmp = mkdtempSync(join(tmpdir(), "fr-range-"));
  cpSync(srcDir, tmp, { recursive: true });
  writeFileSync(join(tmp, "package.json"), '{"type":"module"}');
  return (await import(pathToFileURL(join(tmp, "worker.js")).href)).default;
}
function baseSrc() {
  const base = process.env.FR_RANGE_BASE || "44b7cf5";
  const dir = mkdtempSync(join(tmpdir(), "fr-range-base-"));
  const files = execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", base, "src/"], { encoding: "utf8" }).trim().split("\n");
  for (const f of files) {
    const out = join(dir, f.slice(4));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, execFileSync("git", ["-C", root, "show", `${base}:${f}`]));
  }
  return dir;
}
// Node has no HTMLRewriter: a pass-through stand-in, the same for both workers.
globalThis.HTMLRewriter = class { on() { return this; } transform(r) { return r; } };
const NEW = await load(join(root, "src"));
const OLD = await load(baseSrc());

const MP4 = "/assets/people-are-saying/ep1-nointro-4x5.mp4";
const mp4 = readFileSync(join(root, MP4.slice(1)));
const SIZE = mp4.byteLength;
const FILES = {
  [MP4]: [mp4, "video/mp4"],
  "/assets/logo.jpg": [readFileSync(join(root, "assets/logo.jpg")), "image/jpeg"],
  "/home/": [readFileSync(join(root, "home/index.html")), "text/html; charset=utf-8"],
  "/writings/": [readFileSync(join(root, "writings/index.html")), "text/html; charset=utf-8"],
  "/briefing/": [readFileSync(join(root, "briefing/index.html")), "text/html; charset=utf-8"],
};
// Like Workers Static Assets: Range is ignored (always 200 + whole file), HEAD has no body; body streamed in 64 KiB chunks.
const ENV = {
  ASSETS: {
    fetch: async (req) => {
      const f = FILES[new URL(req.url).pathname];
      if (!f) return new Response("Not found page", { status: 404, headers: { "content-type": "text/plain" } });
      const [bytes, type] = f;
      const headers = { "content-type": type, "content-length": String(bytes.byteLength), etag: '"e1"' };
      if (req.method === "HEAD") return new Response(null, { status: 200, headers });
      let i = 0;
      const body = new ReadableStream({ pull(c) { if (i >= bytes.byteLength) return c.close(); c.enqueue(new Uint8Array(bytes.subarray(i, i + 65536))); i += 65536; } });
      return new Response(body, { status: 200, headers });
    },
  },
  FR_STORE: { idFromName: () => "id", get: () => ({ fetch: async () => Response.json({ ok: true }) }) },
};
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
async function call(w, path, { method = "GET", headers = {} } = {}) {
  const res = await w.fetch(new Request("https://www.foundersramp.net" + path, { method, headers: { "user-agent": UA, ...headers } }), ENV, { waitUntil() {} });
  const body = Buffer.from(await res.arrayBuffer());
  return { status: res.status, h: Object.fromEntries(res.headers), body };
}
const md5 = (b) => createHash("md5").update(b).digest("hex");
const log = (name, r) => console.log(`# ${name}: ${r.status} content-range=${r.h["content-range"] ?? "-"} content-length=${r.h["content-length"] ?? "-"} accept-ranges=${r.h["accept-ranges"] ?? "-"} content-type=${r.h["content-type"] ?? "-"} cache-control=${r.h["cache-control"] ?? "-"} body=${r.body.length}`);

test("mp4 bytes=0-1 -> 206, 2 bytes", async () => {
  const r = await call(NEW, MP4, { headers: { range: "bytes=0-1" } }); log("bytes=0-1", r);
  assert.equal(r.status, 206); assert.equal(r.h["content-range"], `bytes 0-1/${SIZE}`); assert.equal(r.h["content-length"], "2");
  assert.equal(r.h["accept-ranges"], "bytes"); assert.equal(r.h["content-type"], "video/mp4"); assert.equal(r.h["cache-control"], "public, max-age=2592000");
  assert.equal(r.h["x-content-type-options"], "nosniff"); assert.deepEqual(r.body, mp4.subarray(0, 2));
});
test("mp4 bytes=1000-1999 -> 206, 1000 bytes (crosses no chunk) and bytes=65530-131080 (crosses chunks)", async () => {
  let r = await call(NEW, MP4, { headers: { range: "bytes=1000-1999" } }); log("bytes=1000-1999", r);
  assert.equal(r.status, 206); assert.equal(r.h["content-range"], `bytes 1000-1999/${SIZE}`); assert.equal(r.body.length, 1000); assert.deepEqual(r.body, mp4.subarray(1000, 2000));
  r = await call(NEW, MP4, { headers: { range: "bytes=65530-131080" } }); log("bytes=65530-131080", r);
  assert.equal(r.status, 206); assert.equal(r.body.length, 65551); assert.deepEqual(r.body, mp4.subarray(65530, 131081));
});
test("mp4 suffix bytes=-500 -> last 500 bytes", async () => {
  const r = await call(NEW, MP4, { headers: { range: "bytes=-500" } }); log("bytes=-500", r);
  assert.equal(r.status, 206); assert.equal(r.h["content-range"], `bytes ${SIZE - 500}-${SIZE - 1}/${SIZE}`); assert.equal(r.h["content-length"], "500"); assert.deepEqual(r.body, mp4.subarray(SIZE - 500));
});
test("mp4 open-ended bytes=100- and bytes=0- -> to the end", async () => {
  let r = await call(NEW, MP4, { headers: { range: "bytes=100-" } }); log("bytes=100-", r);
  assert.equal(r.status, 206); assert.equal(r.h["content-range"], `bytes 100-${SIZE - 1}/${SIZE}`); assert.equal(r.h["content-length"], String(SIZE - 100)); assert.deepEqual(r.body, mp4.subarray(100));
  r = await call(NEW, MP4, { headers: { range: "bytes=0-" } }); log("bytes=0-", r);
  assert.equal(r.status, 206); assert.equal(r.body.length, SIZE); assert.equal(md5(r.body), "f67526a622c4824358bc3ff454b9063d");
});
test("mp4 end past the file is clamped: bytes=24177900-99999999", async () => {
  const r = await call(NEW, MP4, { headers: { range: "bytes=24177900-99999999" } }); log("bytes=24177900-99999999", r);
  assert.equal(r.status, 206); assert.equal(r.h["content-range"], `bytes 24177900-${SIZE - 1}/${SIZE}`); assert.equal(r.body.length, SIZE - 24177900);
});
test("mp4 out of range -> 416 bytes */size", async () => {
  for (const range of [`bytes=${SIZE}-`, "bytes=99999999-100000000", "bytes=-0"]) {
    const r = await call(NEW, MP4, { headers: { range } }); log(range, r);
    assert.equal(r.status, 416); assert.equal(r.h["content-range"], `bytes */${SIZE}`); assert.equal(r.body.length, 0);
  }
});
test("mp4 no Range -> 200 whole file + Accept-Ranges", async () => {
  const r = await call(NEW, MP4); log("no Range", r);
  assert.equal(r.status, 200); assert.equal(r.h["accept-ranges"], "bytes"); assert.equal(r.h["content-length"], String(SIZE));
  assert.equal(r.h["content-range"], undefined); assert.equal(md5(r.body), "f67526a622c4824358bc3ff454b9063d");
});
test("mp4 multi-range, malformed, reversed, stale If-Range -> 200 whole file", async () => {
  for (const headers of [{ range: "bytes=0-1,5-9" }, { range: "items=0-1" }, { range: "bytes=10-5" }, { range: "bytes=0-1", "if-range": '"other"' }]) {
    const r = await call(NEW, MP4, { headers }); log(JSON.stringify(headers), r);
    assert.equal(r.status, 200); assert.equal(r.body.length, SIZE); assert.equal(r.h["accept-ranges"], "bytes");
  }
  const r = await call(NEW, MP4, { headers: { range: "bytes=0-1", "if-range": '"e1"' } }); log("If-Range matching", r);
  assert.equal(r.status, 206);
});
test("mp4 HEAD: no Range -> 200 headers only; Range -> 206 headers only", async () => {
  let r = await call(NEW, MP4, { method: "HEAD" }); log("HEAD", r);
  assert.equal(r.status, 200); assert.equal(r.h["accept-ranges"], "bytes"); assert.equal(r.h["content-length"], String(SIZE)); assert.equal(r.body.length, 0);
  r = await call(NEW, MP4, { method: "HEAD", headers: { range: "bytes=0-1" } }); log("HEAD bytes=0-1", r);
  assert.equal(r.status, 206); assert.equal(r.h["content-range"], `bytes 0-1/${SIZE}`); assert.equal(r.h["content-length"], "2"); assert.equal(r.body.length, 0);
  r = await call(NEW, MP4, { method: "HEAD", headers: { range: `bytes=${SIZE}-` } }); log("HEAD out of range", r);
  assert.equal(r.status, 416); assert.equal(r.h["content-range"], `bytes */${SIZE}`);
});
test("other routes byte-identical to the base worker (status, headers, body)", async () => {
  const cases = [
    ["/", {}], ["/writings/", {}], ["/briefing/", {}], ["/assets/logo.jpg", {}],
    ["/assets/logo.jpg", { headers: { range: "bytes=0-1" } }], ["/assets/logo.jpg", { method: "HEAD" }],
    ["/writings/", { headers: { range: "bytes=0-1" } }], ["/api/lead", {}], ["/spacex-erp", {}], ["/home/", {}],
    ["/go/book", {}], ["/no-such-page", {}],
  ];
  for (const [path, opt] of cases) {
    const a = await call(OLD, path, opt), b = await call(NEW, path, opt);
    console.log(`# unchanged ${opt.method || "GET"} ${path} ${JSON.stringify(opt.headers || {})}: base ${a.status}/${a.body.length}B new ${b.status}/${b.body.length}B accept-ranges=${b.h["accept-ranges"] ?? "-"}`);
    assert.equal(b.status, a.status, path); assert.deepEqual(b.h, a.h, path); assert.ok(a.body.equals(b.body), path);
  }
});
