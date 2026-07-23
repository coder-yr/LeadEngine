import requests
from bs4 import BeautifulSoup

def search_yahoo(query):
    url = "https://search.yahoo.com/search"
    params = {"p": query}
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    resp = requests.get(url, params=params, headers=headers)
    print(f"Status: {resp.status_code}")
    
    soup = BeautifulSoup(resp.text, "html.parser")
    results = []
    
    for div in soup.find_all("div", class_="algo"):
        title_el = div.find("h3")
        a_el = title_el.find("a") if title_el else None
        
        if not a_el:
            continue
            
        title = a_el.get_text(strip=True)
        href = a_el.get("href", "")
        
        # snippet
        snippet_el = div.find("div", class_="compTitle") 
        if not snippet_el:
            snippet_el = div.find("div", class_="compText")
        snippet = snippet_el.get_text(strip=True) if snippet_el else ""
            
        results.append({
            "title": title,
            "url": href,
            "snippet": snippet
        })
        
    for r in results:
        print(r)
        
search_yahoo('site:justdial.com "dentist" "mumbai"')
