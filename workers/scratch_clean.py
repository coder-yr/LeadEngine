import sys
from bs4 import BeautifulSoup

def trace_clean_html():
    with open("sabka_playwright.html", "r", encoding="utf-8") as f:
        html = f.read()

    soup = BeautifulSoup(html, 'html.parser')
    
    # Remove unwanted tags
    for el in soup(['script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 'nav', 'aside']):
        el.decompose()
        
    # Remove visually hidden elements
    for el in soup.find_all(attrs={"aria-hidden": "true"}):
        el.decompose()
    for el in soup.find_all(style=lambda value: value and ('display:none' in value.replace(' ','') or 'visibility:hidden' in value.replace(' ',''))):
        el.decompose()
        
    print(f"After tags/hidden, soup length is {len(str(soup))}")

    # Remove overlays / banners
    bad_classes = ['cookie', 'banner', 'popup', 'modal', 'newsletter', 'chat', 'widget', 'ads', 'advertisement']
    for el in soup.find_all(class_=lambda x: x and any(b in str(x).lower() for b in bad_classes)):
        print(f"Decomposing class {el.get('class')}")
        el.decompose()
        
    print(f"After class decompose, soup length is {len(str(soup))}")

    for el in soup.find_all(id=lambda x: x and any(b in str(x).lower() for b in bad_classes)):
        print(f"Decomposing ID {el.get('id')}")
        el.decompose()
        
    print(f"Final soup length is {len(str(soup))}")
    print(f"Words remaining: {len(soup.get_text(separator=' ', strip=True).split())}")

trace_clean_html()
