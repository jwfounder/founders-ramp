// One-time FR measurement pilot, approved Nov 7 2026 12:48 PM ET.
// Ends after Nov14 ET; no scheduler, alarm, persistent identifier or raw IP stored.
export const PILOT_START = Date.parse("2026-11-07T17:48:00Z");
export const PILOT_END = Date.parse("2026-11-15T05:00:00Z");
const BOX_IP_SHA256 = ["a66df1a0e88774bc94488c0383ef883c3b80ff67095f1e14f0c784c30d57c2cf"];
const QA_UA = /bot|crawl|spider|headless|preview|facebookexternalhit|embedly|whatsapp|slack|discord|telegram|skype|curl|wget|python|go-http|node-fetch|okhttp|axios|sawyer-preship|site[-_ ]?check|playwright|puppeteer|grok[-_ ]?bot/i;
export async function matchesIPHash(ip, hashes = BOX_IP_SHA256) {
  if (!ip) return false;
  const b = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip.trim()));
  return hashes.includes([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""));
}
export async function pilotQAReason(request, search = "", now = Date.now()) {
  if (now < PILOT_START || now >= PILOT_END) return "";
  if (request.headers.get("x-fr-qa") === "1") return "explicit-qa";
  const ua = request.headers.get("user-agent") || "";
  if (!ua || QA_UA.test(ua)) return "script-or-bot";
  for (const query of [new URL(request.url).search, search]) {
    const p = new URLSearchParams(query);
    if (/(?:^|[-_ ])(?:qa|test|internal)(?:$|[-_ ])/i.test(p.get("utm_source") || "")) return "qa-tag";
  }
  if (await matchesIPHash(request.headers.get("cf-connecting-ip") || "")) return "box-ip";
  return "";
}
