import os
from PIL import Image, ImageDraw, ImageFont
FD=os.environ["FONTDIR"]; S=2; W,H=1200*S,630*S
def F(sz,w="ExtraBold"): return ImageFont.truetype(f"{FD}/BarlowCondensed-{w}.ttf",sz*S)
BG=(76,195,240); LT=(130,215,248); INK=(22,22,22); RED=(225,6,0)
im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im)
d.ellipse((W-900*S//2*2+300*S,-420*S,W+380*S,520*S),fill=LT)
d.ellipse((-260*S,H-200*S,300*S,H+300*S),fill=LT)
N="assets/newsroom/"
tiles=["2026-09-24-how-vc-funded-saas-gtm-strategies-differ-from-bootstrapped","2026-09-01-alright-will-allred",
       "2026-09-09-champion-change-you-gotta-jump-on-it","2026-10-02-mastercard-and-bmo-pull-payments-inside-enterprise-software",
       "2026-09-25-pipeline-mega-post","2026-09-29-the-most-common-go-to-market-questions-this-expert-gets-fro"]
tw,th=272*S,143*S; gx,gy=20*S,24*S; x0=W-70*S-2*tw-gx; y0=(H-3*th-2*gy)//2
for i,slug in enumerate(tiles):
    t=Image.open(f"{N}{slug}.webp").convert("RGB").resize((tw,th),Image.LANCZOS)
    x=x0+(i%2)*(tw+gx); y=y0+(i//2)*(th+gy)
    d.rectangle((x+8*S,y+8*S,x+tw+8*S,y+th+8*S),fill=INK)
    im.paste(t,(x,y))
d.rectangle((70*S,92*S,70*S+64*S,92*S+8*S),fill=RED)
d.text((70*S,118*S),"FOUNDERS RAMP NEWSROOM",font=F(34,"Bold"),fill=INK)
for j,line in enumerate(["What","operators","are sharing."]):
    d.text((66*S,(172+j*100)*S),line,font=F(104),fill=INK)
im=im.resize((1200,630),Image.LANCZOS)
out=N+"briefing-index.jpg"; q=88
while True:
    im.save(out,"JPEG",quality=q,optimize=True,progressive=True)
    if os.path.getsize(out)<=145000 or q<=50: break
    q-=4
p="briefing/index.html"; s=open(p,encoding="utf-8").read()
old='<meta property="og:image" content="https://www.foundersramp.net/assets/logo.jpg">'
assert s.count(old)==1
url="https://www.foundersramp.net/assets/newsroom/briefing-index.jpg"
s=s.replace(old,f'<meta property="og:image" content="{url}">')
import re; s=re.sub(r'<meta name="twitter:image" content="[^"]*">',f'<meta name="twitter:image" content="{url}">',s)
open(p,"w",encoding="utf-8").write(s)
print(q,os.path.getsize(out))
