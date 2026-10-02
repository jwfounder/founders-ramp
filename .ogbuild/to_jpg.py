import os, re
from PIL import Image
slugs=[]
for f in sorted(os.listdir("writings")):
    if not f.endswith(".html") or f=="index.html": continue
    p="writings/"+f; s=open(p,encoding="utf-8").read()
    m=re.search(r'<meta property="og:image" content="https://www\.foundersramp\.net/assets/writings/([a-z0-9-]+)\.webp">',s)
    if not m: continue
    slug=m.group(1); slugs.append(slug)
    im=Image.open(f"assets/writings/{slug}.webp").convert("RGB")
    assert im.size==(1200,630), slug
    out=f"assets/writings/{slug}.jpg"; q=86
    while True:
        im.save(out,"JPEG",quality=q,optimize=True,progressive=True)
        if os.path.getsize(out)<=195000 or q<=50: break
        q-=4
    url=f"https://www.foundersramp.net/assets/writings/{slug}.jpg"
    s=s.replace(m.group(0),f'<meta property="og:image" content="{url}">')
    s=re.sub(r'<meta name="twitter:image" content="[^"]*">',f'<meta name="twitter:image" content="{url}">',s)
    open(p,"w",encoding="utf-8").write(s)
    print(slug,q,os.path.getsize(out))
print(len(slugs))
p="writings/index.html"; s=open(p,encoding="utf-8").read()
s2=re.sub(r'\n[ \t]*<time class="meta" datetime="[0-9-]+">[0-9-]+</time>(?=\n)','',s)
assert s2.count("<time")==0 and s2!=s
open(p,"w",encoding="utf-8").write(s2); print("index dates removed")
