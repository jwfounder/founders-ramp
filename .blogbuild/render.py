import math, random, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S=2; W,H=1200*S,630*S
FD=os.environ["FONTDIR"]
def F(sz,w="Bold"): return ImageFont.truetype(f"{FD}/BarlowCondensed-{w}.ttf",sz*S)
BG=(18,18,22); INK=(245,245,244); RED=(225,6,0); GREY=(70,72,80); MUT=(140,140,150); TINT=PANEL=SOFT=STAR=GREY
def base(glow=(0.85,0.15)):
    im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im)
    cx,cy=W*glow[0],H*glow[1]; r=P(420)
    d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=TINT)
    return im,d
def theme(bg,ink,tint,panel,soft,mut,red=(225,6,0),star=(255,255,255)):
    global BG,INK,TINT,PANEL,SOFT,GREY,MUT,RED,STAR
    BG,INK,TINT,PANEL,SOFT,MUT,RED,STAR=bg,ink,tint,panel,soft,mut,red,star; GREY=soft
def P(v): return v*S
def label(d,txt,x=70,y=70,sz=30,fill=None):
    fill=fill or RED
    d.text((P(x),P(y)),txt,font=F(sz,"SemiBold"),fill=fill)
def head(d,txt,x=70,y=480,sz=96,fill=None):
    fill=fill or INK
    d.text((P(x),P(y)),txt,font=F(sz,"ExtraBold"),fill=fill)
def save(im,name):
    im=im.resize((1200,630),Image.LANCZOS); os.makedirs("assets/writings",exist_ok=True)
    q=80
    while True:
        im.save(f"assets/writings/{name}.webp","WEBP",quality=q,method=6)
        if os.path.getsize(f"assets/writings/{name}.webp")<140000 or q<40: break
        q-=8
def language_in_business():
    im,d=base((0.8,0.9))
    words=["synergy","leverage","circle back","bandwidth","paradigm","move the needle","best-in-class","low-hanging fruit","deep dive","touch base","alignment","holistic","robust","value-add","ecosystem","going forward","actionable","learnings","double-click","north star"]
    y=60
    R2=random.Random(3)
    while y<600:
        x=R2.randint(-60,0)
        while x<1200:
            w=R2.choice(words); sz=R2.choice([26,30,34,40])
            f=F(sz,"SemiBold"); d.text((P(x),P(y)),w,font=f,fill=SOFT)
            x+=int(d.textlength(w,font=f)/S)+28
        y+=46
    d.rectangle((P(60),P(220),P(1140),P(410)),fill=BG)
    d.rectangle((P(60),P(220),P(72),P(410)),fill=RED)
    d.text((P(100),P(232)),"SAY IT PLAINLY.",font=F(150,"ExtraBold"),fill=INK)
    return im
def five_green_fields():
    im,d=base((0.9,0.1))
    label(d,"REPEATABLE FORECAST")
    head(d,"5 GREEN FIELDS",y=100,sz=96)
    rows=["CLOSE DATE","STAGE","AMOUNT","NEXT STEP","FORECAST"]
    for i,r in enumerate(rows):
        y=250+i*68
        d.rectangle((P(70),P(y),P(1130),P(y+54)),fill=PANEL)
        d.rectangle((P(70),P(y),P(80),P(y+54)),fill=(24,160,90))
        d.text((P(100),P(y+8)),r,font=F(36,"SemiBold"),fill=INK)
        for j in range(5):
            d.rectangle((P(560+j*110),P(y+14),P(650+j*110),P(y+40)),fill=(24,160,90) if (i+j)%7 else RED)
    return im
def spacex_erp():
    im,d=base((0.5,1.1))
    R2=random.Random(11)
    for _ in range(220):
        x,y=R2.randint(0,W),R2.randint(0,P(420)); r=R2.choice([1,1,2,3]); d.ellipse((x,y,x+r*S,y+r*S),fill=STAR)
    # trajectory
    pts=[(P(80+t*10.4),P(600-470*math.sin(t/100*math.pi/2)**0.9)) for t in range(101)]
    for i in range(len(pts)-1): d.line((pts[i],pts[i+1]),fill=RED,width=P(5))
    steps=["QUESTION","DELETE","SIMPLIFY","ACCELERATE","AUTOMATE"]
    for k,s in enumerate(steps):
        t=10+k*20; x,y=pts[t]; d.ellipse((x-P(9),y-P(9),x+P(9),y+P(9)),fill=INK)
        d.text((x+P(14),y+P(4)),s,font=F(30,"SemiBold"),fill=INK)
    # rocket at end
    x,y=pts[100]; ang=-0.08
    rk=Image.new("RGBA",(P(70),P(200)),(0,0,0,0)); rd=ImageDraw.Draw(rk)
    rd.polygon([(P(35),0),(P(58),P(50)),(P(58),P(150)),(P(12),P(150)),(P(12),P(50))],fill=INK)
    rd.polygon([(P(12),P(110)),(0,P(165)),(P(12),P(150))],fill=RED); rd.polygon([(P(58),P(110)),(P(70),P(165)),(P(58),P(150))],fill=RED)
    rd.polygon([(P(20),P(150)),(P(50),P(150)),(P(35),P(200))],fill=(255,140,40))
    rk=rk.rotate(-70,expand=True)
    im.paste(rk,(int(x-P(150)),int(y-P(40))),rk)
    d.text((P(70),P(60)),"ERP AS A LAUNCH",font=F(84,"ExtraBold"),fill=INK)
    label(d,"IN THAT ORDER",y=160)
    return im
def no_transition():
    im,d=base((0.1,0.9))
    phases=["FIRST CUSTOMERS","REPEATABLE","FIRST SELLER","TEAM","SALES LEADER"]
    for i,p in enumerate(phases):
        x=90+i*220
        d.rectangle((P(x),P(260),P(x+180),P(400)),outline=GREY,width=P(3))
        d.text((P(x+12),P(410)),p,font=F(26,"SemiBold"),fill=MUT)
    d.line((P(40),P(330),P(1160),P(330)),fill=RED,width=P(10))
    d.polygon([(P(1160),P(310)),(P(1190),P(330)),(P(1160),P(350))],fill=RED)
    label(d,"THE FOUNDER STAYS ON THE LINE")
    head(d,"NO TRANSITION OUT",y=100,sz=100)
    return im
def glengarry():
    im,d=base((0.5,0.0))
    R2=random.Random(5)
    for _ in range(260):
        x=R2.randint(0,W); y=R2.randint(0,H); l=R2.randint(20,60)*S
        d.line((x,y,x-P(6),y+l),fill=SOFT,width=S)
    # index cards
    for i in range(5):
        x=640+i*24; y=170+i*26
        d.rectangle((P(x),P(y),P(x+420),P(y+250)),fill=(236,234,226),outline=(180,178,170),width=S)
        for k in range(4): d.line((P(x+20),P(y+70+k*40),P(x+400),P(y+70+k*40)),fill=(170,190,220),width=S)
        d.line((P(x+20),P(y+40),P(x+400),P(y+40)),fill=RED,width=P(2))
    d.text((P(760),P(310)),"LEADS",font=F(80,"ExtraBold"),fill=RED)
    d.text((P(70),P(160)),"THE FAMOUS",font=F(90,"ExtraBold"),fill=INK)
    d.text((P(70),P(250)),"LINES ARE NOT",font=F(90,"ExtraBold"),fill=INK)
    d.text((P(70),P(340)),"THE LESSONS",font=F(90,"ExtraBold"),fill=RED)
    label(d,"SALES LESSONS · PART 1")
    return im
def shiny_object():
    im,d=base((0.7,0.4))
    cx,cy=P(820),P(320)
    top=[(cx-P(170),cy-P(60)),(cx-P(90),cy-P(140)),(cx+P(90),cy-P(140)),(cx+P(170),cy-P(60))]
    d.polygon(top+[(cx,cy+P(200))],fill=PANEL)
    d.polygon([top[0],top[1],(cx,cy-P(60))],fill=(120,220,255))
    d.polygon([top[1],top[2],(cx,cy-P(60))],fill=(230,250,255))
    d.polygon([top[2],top[3],(cx,cy-P(60))],fill=(80,190,240))
    d.polygon([top[0],(cx,cy-P(60)),(cx,cy+P(200))],fill=(40,140,210))
    d.polygon([top[3],(cx,cy-P(60)),(cx,cy+P(200))],fill=RED)
    for a in range(0,360,30):
        r1,r2=P(230),P(290 if a%60 else 330); t=math.radians(a)
        d.line((cx+r1*math.cos(t),cy+r1*math.sin(t),cx+r2*math.cos(t),cy+r2*math.sin(t)),fill=INK,width=P(3))
    d.text((P(70),P(180)),"YOUR",font=F(100,"ExtraBold"),fill=INK)
    d.text((P(70),P(280)),"SHINY",font=F(100,"ExtraBold"),fill=INK)
    d.text((P(70),P(380)),"OBJECT?",font=F(100,"ExtraBold"),fill=RED)
    label(d,"OR THEIR PROBLEM")
    return im
def measuring():
    im,d=base((0.5,0.5))
    # rear view mirror
    d.rounded_rectangle((P(560),P(150),P(1140),P(420)),radius=P(130),fill=PANEL,outline=INK,width=P(6))
    d.rectangle((P(840),P(420),P(860),P(500)),fill=INK)
    pts=[(P(620+i*24),P(330-40*math.sin(i/3)-i*4)) for i in range(20)]
    d.line(pts,fill=MUT,width=P(5))
    d.text((P(640),P(180)),"ALREADY HAPPENED",font=F(30,"SemiBold"),fill=MUT)
    d.line((P(70),P(560),P(1130),P(560)),fill=GREY,width=P(2))
    d.text((P(70),P(150)),"WHAT ARE",font=F(96,"ExtraBold"),fill=INK)
    d.text((P(70),P(245)),"YOU",font=F(96,"ExtraBold"),fill=INK)
    d.text((P(70),P(340)),"MEASURING?",font=F(96,"ExtraBold"),fill=RED)
    label(d,"THE FORECAST IS THE WORK")
    return im
def agentic():
    im,d=base((0.8,0.5))
    door=(P(900),P(200),P(1040),P(470))
    d.rectangle(door,fill=RED); d.ellipse((P(1010),P(330),P(1024),P(344)),fill=INK)
    R2=random.Random(9)
    for i in range(16):
        sx=R2.randint(60,500); sy=R2.randint(160,600)
        d.line((P(sx),P(sy),P(890),P(335)),fill=SOFT,width=P(2))
        d.ellipse((P(sx-6),P(sy-6),P(sx+6),P(sy+6)),fill=INK)
    d.text((P(70),P(60)),"ONE FRONT DOOR",font=F(90,"ExtraBold"),fill=INK)
    label(d,"INTAKE BEFORE AGENTS",y=160)
    return im
def first_hire():
    im,d=base((0.2,0.8))
    # flowchart freezing
    boxes=[(560,140),(820,140),(560,320),(820,320),(690,480)]
    for (x,y) in boxes:
        d.rectangle((P(x),P(y),P(x+200),P(y+110)),fill=PANEL,outline=INK,width=P(3))
    for a,b in [(0,1),(0,2),(1,3),(2,4),(3,4)]:
        (x1,y1),(x2,y2)=boxes[a],boxes[b]; d.line((P(x1+100),P(y1+55),P(x2+100),P(y2+55)),fill=INK,width=P(3))
    for (x,y) in boxes:
        d.rectangle((P(x),P(y),P(x+200),P(y+110)),fill=PANEL,outline=INK,width=P(3))
    R2=random.Random(2)
    for _ in range(40):
        x=R2.randint(540,1040); y=R2.randint(130,600); r=R2.randint(8,22)
        for k in range(3):
            t=math.radians(k*60); d.line((P(x-r*math.cos(t)),P(y-r*math.sin(t)),P(x+r*math.cos(t)),P(y+r*math.sin(t))),fill=INK,width=S)
    d.text((P(70),P(160)),"THE FIRST",font=F(96,"ExtraBold"),fill=INK)
    d.text((P(70),P(255)),"HIRE",font=F(96,"ExtraBold"),fill=INK)
    d.text((P(70),P(350)),"FREEZES IT",font=F(96,"ExtraBold"),fill=RED)
    label(d,"WHATEVER PROCESS YOU HAVE")
    return im
def one_person():
    im,d=base((0.75,0.3))
    nodes=[(860,130)]+[(700+i*110,260) for i in range(4)]+[(640+i*90,400) for i in range(7)]
    edges=[(0,i) for i in range(1,5)]+[(1+i//2,5+i) for i in range(7)]
    for a,b in edges: d.line((P(nodes[a][0]),P(nodes[a][1]),P(nodes[b][0]),P(nodes[b][1])),fill=GREY,width=P(2))
    for i,(x,y) in enumerate(nodes):
        r=26; col=RED if i==8 else PANEL
        d.ellipse((P(x-r),P(y-r),P(x+r),P(y+r)),fill=col,outline=MUT if i!=8 else INK,width=P(2))
    d.text((P(800),P(470)),"1 of 12",font=F(40,"Bold"),fill=RED)
    d.text((P(70),P(160)),"ONE PERSON",font=F(92,"ExtraBold"),fill=INK)
    d.text((P(70),P(250)),"LOVED THE DEMO.",font=F(92,"ExtraBold"),fill=INK)
    d.text((P(70),P(340)),"THE COMPANY",font=F(92,"ExtraBold"),fill=MUT)
    d.text((P(70),P(430)),"NEVER DECIDED.",font=F(92,"ExtraBold"),fill=RED)
    label(d,"INSPECT A LIVE DEAL")
    return im
def already_use():
    im,d=base((0.1,0.2))
    d.rectangle((P(70),P(260),P(330),P(440)),fill=PANEL,outline=INK,width=P(3))
    d.text((P(105),P(320)),"THEIR TOOL",font=F(44,"Bold"),fill=INK)
    steps=["EXPORT","CHECK","RETYPE","SEND"]
    x=380
    for i,s in enumerate(steps):
        d.line((P(x),P(350),P(x+40),P(350)),fill=RED,width=P(4))
        d.rectangle((P(x+50),P(310),P(x+210),P(390)),outline=RED,width=P(3))
        d.text((P(x+70),P(325)),s,font=F(38,"SemiBold"),fill=INK)
        x+=210
    d.text((P(70),P(60)),"\u201cWE ALREADY USE",font=F(86,"ExtraBold"),fill=INK)
    d.text((P(70),P(150)),"SOMETHING FOR THAT.\u201d",font=F(86,"ExtraBold"),fill=INK)
    d.text((P(380),P(430)),"WHAT HAPPENS AFTER THE DATA LEAVES?",font=F(40,"Bold"),fill=RED)
    return im
def vc_boot():
    im,d=base((0.85,0.2))
    d.line((P(70),P(560),P(1130),P(560)),fill=GREY,width=P(2))
    pts=[(P(560+i*5.6),P(560-430*(i/100)**3)) for i in range(101)]
    d.line(pts,fill=RED,width=P(6))
    x,y=560,560
    for i in range(7):
        d.line((P(x),P(y),P(x+80),P(y)),fill=INK,width=P(5)); d.line((P(x+80),P(y),P(x+80),P(y-40)),fill=INK,width=P(5)); x+=80; y-=40
    d.text((P(1000),P(110)),"VC-BACKED",font=F(34,"Bold"),fill=RED)
    d.text((P(590),P(462)),"BOOTSTRAPPED",font=F(34,"Bold"),fill=INK)
    d.text((P(70),P(150)),"TWO WAYS",font=F(96,"ExtraBold"),fill=INK)
    d.text((P(70),P(245)),"TO FAIL.",font=F(96,"ExtraBold"),fill=INK)
    d.text((P(70),P(340)),"PICK ONE",font=F(96,"ExtraBold"),fill=RED)
    d.text((P(70),P(435)),"MOTION.",font=F(96,"ExtraBold"),fill=RED)
    label(d,"GTM · FUNDED VS BOOTSTRAPPED")
    return im
def allred():
    im,d=base((0.3,0.3))
    bub=[(620,110,1120,230,"ALRIGHT, I'LL BITE.",RED,(22,22,22)),(560,270,1000,370,"what worked for you?",(255,255,255),(22,22,22)),(700,410,1140,510,"here's what we tried",(255,255,255),(22,22,22))]
    for x1,y1,x2,y2,t,bg,fg in bub:
        if bg!=BG:
            d.rounded_rectangle((P(x1),P(y1),P(x2),P(y2)),radius=P(26),fill=bg)
            d.polygon([(P(x1+40),P(y2)),(P(x1+70),P(y2)),(P(x1+30),P(y2+26))],fill=bg)
        d.text((P(x1+28),P(y1+(y2-y1)/2-24)),t,font=F(44 if bg==RED else 38,"Bold"),fill=fg)
    d.text((P(70),P(180)),"ASK THE",font=F(100,"ExtraBold"),fill=INK)
    d.text((P(70),P(280)),"PEOPLE WHO",font=F(100,"ExtraBold"),fill=INK)
    d.text((P(70),P(380)),"DID IT.",font=F(100,"ExtraBold"),fill=RED)
    label(d,"COMMUNITY WISDOM")
    return im
DK=(22,22,22); WH=(255,255,255)
THEMES={
 "language-in-business":((255,210,63),DK,(255,224,120),(255,224,120),(214,170,30),(90,70,0)),
 "five-green-fields":((20,33,61),WH,(32,52,95),(36,58,104),(70,90,130),(170,185,210)),
 "spacex-erp":((31,79,216),WH,(52,100,232),(52,100,232),(120,150,240),(200,215,255),(255,138,0)),
 "no-transition":((18,163,154),WH,(40,185,175),(40,185,175),(150,225,220),(220,250,247)),
 "glengarry-glen-ross":((255,111,89),DK,(255,140,120),(255,140,120),(225,85,65),(90,30,20),DK),
 "shiny-object":((108,60,224),WH,(130,90,235),(80,40,180),(170,140,245),(220,210,255),(255,210,63)),
 "what-are-you-measuring":((184,224,74),DK,(204,236,120),(150,190,50),(130,170,40),(60,80,10)),
 "agentic-procurement":((255,138,31),DK,(255,165,80),(255,165,80),(200,100,10),(90,40,0)),
 "first-hire-freezes":((158,216,245),DK,(190,230,250),(255,255,255),(110,170,210),(40,80,110)),
 "one-person-loved-the-demo":((255,194,209),DK,(255,215,226),(255,255,255),(230,150,170),(120,60,75)),
 "we-already-use-something":((61,220,151),DK,(110,232,180),(255,255,255),(30,170,110),(20,80,50)),
}
JOBS={"language-in-business":language_in_business,"five-green-fields":five_green_fields,"spacex-erp":spacex_erp,"no-transition":no_transition,"glengarry-glen-ross":glengarry,"shiny-object":shiny_object,"what-are-you-measuring":measuring,"agentic-procurement":agentic,"first-hire-freezes":first_hire,"one-person-loved-the-demo":one_person,"we-already-use-something":already_use}
if __name__=="__main__":
    for k,f in JOBS.items(): theme(*THEMES[k]); save(f(),k)
