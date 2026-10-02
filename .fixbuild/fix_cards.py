import re
for p in ["home/index.html","briefing/index.html"]:
    s=open(p,encoding="utf-8").read()
    n0=s.count('<a class="card news"')
    s,n1=re.subn(r'(<a class="card news" href="https://[^"]+") rel="noopener"', r'\1 target="_blank" rel="noopener"', s)
    s,n2=re.subn(r'<span class="news-body">(.*?)</span>(\s*</a>)', r'<div class="news-body">\1</div>\2', s, flags=re.S)
    assert n0==n1==n2 and n0>0, (p,n0,n1,n2)
    open(p,"w",encoding="utf-8").write(s); print(p,n0)
