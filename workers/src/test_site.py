import requests

r = requests.get(
    "https://trijog.com",
    headers={
        "User-Agent":
        "Mozilla/5.0"
    }
)

print("Status:", r.status_code)
print("Length:", len(r.text))
print(r.text[:1000])