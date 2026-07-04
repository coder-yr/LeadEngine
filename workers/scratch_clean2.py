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
    bad_classes = ['cookie', 'popup', 'modal', 'newsletter', 'chat', 'advertisement']
    elements_to_decompose = []
    
    for el in soup.find_all(class_=lambda x: x and any(b in str(x).lower() for b in bad_classes)):
        elements_to_decompose.append(el)
        
    for el in soup.find_all(id=lambda x: x and any(b in str(x).lower() for b in bad_classes)):
        elements_to_decompose.append(el)

    for el in elements_to_decompose:
        if el.parent is not None:
            el.decompose()
        
    print(f"Final soup length is {len(str(soup))}")
    print(f"Words remaining: {len(soup.get_text(separator=' ', strip=True).split())}")
    
    # Let's check footer
    footer = soup.find('footer') or soup.find(class_=lambda x: x and 'footer' in str(x).lower())
    if footer:
        print(f"Footer found! {len(footer.get_text(separator=' ', strip=True).split())} words")
    else:
        print("No footer found.")

trace_clean_html()
