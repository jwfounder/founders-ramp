import re
for slug in ["language-in-business","five-green-fields","spacex-erp","no-transition","glengarry-glen-ross","shiny-object","what-are-you-measuring","agentic-procurement","equal-commitment","first-hire-freezes"]:
    p = f"writings/{slug}.html"; s = open(p, encoding="utf-8").read()
    s2 = re.sub(r'(<meta property="og:image" content=")[^"]+(">)', lambda m: m.group(1) + f"https://www.foundersramp.net/assets/writings/{slug}.webp" + m.group(2), s, count=1)
    assert s2 != s, slug; open(p, "w", encoding="utf-8").write(s2)
p = "briefing/index.html"; s = open(p, encoding="utf-8").read()
s = s.replace("What operators are sharing. It accumulates.", "What operators are sharing. We keep them. Newest first.")
alts = {"Sharné McDonald": ("2026-09-24-how-vc-funded-saas-gtm-strategies-differ-from-bootstrapped", "Illustration: a steep dark growth curve labeled VC-backed beside a steady white staircase labeled bootstrapped, with the words two ways to fail, pick one motion."),
        "Will Allred": ("2026-09-01-alright-will-allred", "Illustration: a stack of chat bubbles starting with alright, I will bite, beside the words ask the people who did it.")}
for name, (slug, alt) in alts.items():
    old = f'<span class="thumb thumb-fallback"><span class="thumb-name">{name}</span></span>'
    assert old in s, name
    s = s.replace(old, f'<span class="thumb"><img src="../assets/newsroom/{slug}.webp" alt="{alt}" width="720" height="378" loading="lazy" decoding="async"></span>')
open(p, "w", encoding="utf-8").write(s)
s = open("sitemap.xml").read()
a = "  <url><loc>https://www.foundersramp.net/writings/agentic-procurement</loc><lastmod>2026-10-02</lastmod></url>\n"
add = "".join(f"  <url><loc>https://www.foundersramp.net/writings/{x}</loc><lastmod>2026-10-02</lastmod></url>\n" for x in ["one-person-loved-the-demo", "we-already-use-something"])
assert a in s; open("sitemap.xml", "w").write(s.replace(a, a + add))
l = open("llms.txt").read()
b = "- [From chatbots to agentic procurement](https://www.foundersramp.net/writings/agentic-procurement)\n"
add2 = "- [One person loved the demo. The company never decided.](https://www.foundersramp.net/writings/one-person-loved-the-demo): Name the economic buyer, the champion, and who is hurt if this slips\n- [We already use something for that.](https://www.foundersramp.net/writings/we-already-use-something): Ask what happens after the data leaves that system\n"
assert b in l; open("llms.txt", "w").write(l.replace(b, b + add2))
print("applied")
