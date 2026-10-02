import json, re, html, io, os, subprocess
from PIL import Image
D = json.load(open(".newsroom/gen_data.json"))
p = "briefing/index.html"; s = open(p, encoding="utf-8").read()
cards = re.findall(r'<a class="card" href="([^"]+)" rel="noopener">\s*<p class="meta">([^<]+)</p>\s*<h3>(.*?)</h3>\s*<p>(.*?)</p>\s*</a>', s, re.S)
E = [dict(i=i, url=u, date=d, title=t, body=b, topic=D["topics"][u], img=(D["imgs"].get(u) or [None, None])[1]) for i, (u, d, t, b) in enumerate(cards)]
T = {"founder": "Founder-led sales", "pipeline": "Pipeline and deals", "buyers": "Buyers and markets", "ai": "AI at work"}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
W, H = 720, 378
os.makedirs("assets/newsroom", exist_ok=True)
for u, (og, path) in D["imgs"].items():
    if os.path.exists(path): continue
    b = subprocess.run(["curl", "-sL", "-m", "30", "-A", UA, og], capture_output=True).stdout
    im = Image.open(io.BytesIO(b)); im.load(); im = im.convert("RGB")
    w, h = im.size; r = max(W / w, H / h)
    im = im.resize((max(W, round(w * r)), max(H, round(h * r))), Image.LANCZOS)
    w, h = im.size; l = (w - W) // 2; t = (h - H) // 2 if h / H < 1.6 else int((h - H) * 0.2)
    im.crop((l, t, l + W, t + H)).save(path, "WEBP", quality=70, method=6)
order = sorted(E, key=lambda e: (e["date"], -e["i"]), reverse=True)
def src(body):
    m = re.search(r"\s*Source:\s*(.+?)\.?\s*$", body)
    return (body[:m.start()].strip(), m.group(1).strip()) if m else (body, "")
out = []
for e in order:
    body, sname = src(e["body"]); tt = html.unescape(e["title"])
    if e["img"]:
        alt = html.escape(f"Preview image from {html.unescape(sname)}: {tt}", quote=True)
        thumb = f'<img src="../{e["img"]}" alt="{alt}" width="720" height="378" loading="lazy" decoding="async">'; cls = "thumb"
    else:
        thumb = f'<span class="thumb-name">{html.escape(html.unescape(sname).split("(")[0].strip())}</span>'; cls = "thumb thumb-fallback"
    out.append(f'''          <a class="card news" href="{e['url']}" rel="noopener" data-topic="{e['topic']}">
            <span class="{cls}">{thumb}</span>
            <span class="news-body">
              <span class="news-meta"><span class="news-topic">{T[e['topic']]}</span> <time datetime="{e['date']}">{e['date']}</time></span>
              <h3>{e['title']}</h3>
              <p>{body}</p>
              <span class="news-source">{sname}</span>
            </span>
          </a>''')
counts = {k: sum(1 for e in E if e["topic"] == k) for k in T}
tabs = "\n".join([f'          <button type="button" class="tab" data-filter="all" aria-pressed="true">All <span>{len(E)}</span></button>'] + [f'          <button type="button" class="tab" data-filter="{k}" aria-pressed="false">{T[k]} <span>{counts[k]}</span></button>' for k in T])
section = f'''    <section class="newsroom">
      <div class="wrap">
        <div class="tabs" role="group" aria-label="Filter by topic">
{tabs}
        </div>
        <div class="cards news-grid">
{chr(10).join(out)}
        </div>
      </div>
    </section>'''
s2 = re.sub(r'    <section>\n      <div class="wrap">\n        <div class="cards">.*?\n    </section>', lambda m: section, s, count=1, flags=re.S)
s2 = s2.replace('<link rel="stylesheet" href="../css/site.css?v=os31">', '<link rel="stylesheet" href="../css/site.css?v=os31">\n  <link rel="stylesheet" href="newsroom.css?v=nr1">', 1)
s2 = s2.replace('<script src="../js/quotes.js?v=rec3" defer></script>', '<script src="../js/quotes.js?v=rec3" defer></script>\n  <script src="newsroom.js?v=nr1" defer></script>', 1)
open(p, "w", encoding="utf-8").write(s2)
print("cards", len(E), counts)
