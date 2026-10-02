from PIL import Image, ImageDraw
import os
R="assets/"
def framed(src,bg,out,pad=40,shadow=(0,0,0)):
    W,H=1200,630
    im=Image.new("RGB",(W,H),bg); d=ImageDraw.Draw(im)
    d.ellipse((W-520,-260,W+260,520),fill=tuple(min(255,c+30) for c in bg))
    s=Image.open(R+src).convert("RGB"); s.thumbnail((W-2*pad-200,H-2*pad))
    x=(W-s.width)//2; y=(H-s.height)//2
    d.rectangle((x+12,y+12,x+s.width+12,y+s.height+12),fill=(22,22,22))
    im.paste(s,(x,y))
    q=82
    while True:
        im.save(out,"WEBP",quality=q,method=6)
        if os.path.getsize(out)<140000 or q<40: break
        q-=6
framed("product-led-li.jpg",(255,214,102),"assets/writings/product-distribution.webp")
framed("equal-commitment.jpg",(76,195,240),"assets/writings/equal-commitment.webp")
