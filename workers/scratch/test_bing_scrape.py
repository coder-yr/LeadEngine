import requests

def search_bing(query):
    url = "https://www.bing.com/search"
    params = {"q": query}
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.bing.com/"
    }
    resp = requests.get(url, params=params, headers=headers)
    print(f"Status: {resp.status_code}")
    
    with open(r"f:\yash\projects\LeadEngine\workers\scratch\bing.html", "w", encoding="utf-8") as f:
        f.write(resp.text)
        
search_bing('site:justdial.com "dentist" "mumbai"')
