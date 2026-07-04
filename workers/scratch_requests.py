import requests
import time

url = "https://sabkadentist.com"
response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
html = response.text
with open("sabka_requests.html", "w", encoding="utf-8") as f:
    f.write(html)
print(f"Requests downloaded {len(html)} bytes")
