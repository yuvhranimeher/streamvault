from pathlib import Path

search = Path('hostinger/search.js')
index = Path('hostinger/index.html')

s = search.read_text(encoding='utf-8')

# Keep the built-in refined search pointed at the massive catalog.
s = s.replace("massive:'0'", "massive:'1'")
s = s.replace("}, 3500);\n    if(!res.ok)throw new Error(`HTTP ${res.status}`);", "}, 9000);\n    if(!res.ok)throw new Error(`HTTP ${res.status}`);")
search.write_text(s, encoding='utf-8')

html = index.read_text(encoding='utf-8')
tag = '<script defer src="/search-full-catalog-v2.js?v=20260814-full-catalog-v2"></script>'
if tag not in html:
    anchor = '<script defer src="/search.js?v=20260713-hostinger-frontend-v3"></script>'
    if anchor not in html:
        raise SystemExit('search.js loader anchor not found')
    html = html.replace(anchor, anchor + '\n' + tag, 1)
index.write_text(html, encoding='utf-8')

print('full catalog search fallback installed')
