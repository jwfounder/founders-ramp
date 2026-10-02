import os
from PIL import Image, ImageDraw, ImageFont
FD=os.environ["FONTDIR"]; S=2; W,H=1200*S,630*S
def F(sz,w="ExtraBold"): return ImageFont.truetype(f"{FD}/BarlowCondensed-{w}.ttf",sz*S)
BG=(255,210,63); INK=(22,22,22); RED=(225,6,0)
im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im)
d.ellipse((W-900*S//2*2+300*S,-420*S,W+380*S,520*S),fill=(255,226,120))
d.ellipse((-260*S,H-200*S,300*S,H+300*S),fill=(255,226,120))
tiles=["language-in-business","five-green-fields","spacex-erp","we-already-use-something","one-person-loved-the-demo","shiny-object"]
tw,th=272*S,143*S; gx,gy=20*S,24*S; x0=W-70*S-2*tw-gx; y0=(H-3*th-2*gy)//2
for i,slug in enumerate(tiles):
    t=Image.open(f"assets/writings/{slug}.webp").convert("RGB").resize((tw,th),Image.LANCZOS)
    x=x0+(i%2)*(tw+gx); y=y0+(i//2)*(th+gy)
    d.rectangle((x+8*S,y+8*S,x+tw+8*S,y+th+8*S),fill=INK)
    im.paste(t,(x,y))
d.rectangle((70*S,92*S,70*S+64*S,92*S+8*S),fill=RED)
d.text((70*S,118*S),"FOUNDERS RAMP BLOG",font=F(34,"Bold"),fill=INK)
d.text((66*S,170*S),"From",font=F(124),fill=INK)
d.text((66*S,290*S),"the field.",font=F(124),fill=INK)
d.text((70*S,456*S),"Founder-led sales, pipeline and deals,",font=F(32,"SemiBold"),fill=INK)
d.text((70*S,496*S),"written plainly.",font=F(32,"SemiBold"),fill=INK)
im=im.resize((1200,630),Image.LANCZOS)
out="assets/writings/blog-index.jpg"; q=88
while True:
    im.save(out,"JPEG",quality=q,optimize=True,progressive=True)
    if os.path.getsize(out)<=195000 or q<=50: break
    q-=4
p="writings/index.html"; s=open(p,encoding="utf-8").read()
old='<meta property="og:image" content="https://www.foundersramp.net/assets/logo.jpg">'
assert s.count(old)==1
s=s.replace(old,'<meta property="og:image" content="https://www.foundersramp.net/assets/writings/blog-index.jpg">')
open(p,"w",encoding="utf-8").write(s)
print(q,os.path.getsize(out))
