import sys; sys.path.insert(0, ".blogbuild"); import render
from PIL import Image
DK=(22,22,22); WH=(255,255,255)
jobs=[("2026-09-24-how-vc-funded-saas-gtm-strategies-differ-from-bootstrapped",render.vc_boot,((255,79,139),WH,(255,115,165),(255,115,165),(255,170,200),(255,225,235),DK)),
      ("2026-09-01-alright-will-allred",render.allred,((0,166,214),WH,(40,185,228),(255,255,255),(150,220,240),(220,245,255),(255,210,63)))]
for name,fn,th in jobs:
    render.theme(*th)
    fn().resize((720,378),Image.LANCZOS).save(f"assets/newsroom/{name}.webp","WEBP",quality=72,method=6)
