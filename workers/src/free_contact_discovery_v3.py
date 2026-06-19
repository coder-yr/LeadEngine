# free_contact_discovery_v3.py


import argparse
import json
import logging
import re
import urllib.parse
import time
from typing import List, Dict, Any

import requests
from bs4 import BeautifulSoup
import ollama

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0"
}

TITLE_KEYWORDS = [
    "founder",
    "co-founder",
    "ceo",
    "owner",
    "director",
    "managing director",
    "partner",
    "principal",
    "doctor",
    "dentist",
    "psychologist",
    "psychiatrist",
    "manager"
]


def clean_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup([
        "script",
        "style",
        "nav",
        "footer",
        "aside",
        "header",
        "noscript",
        "svg",
        "path",
        "button",
        "form"
    ]):
        tag.decompose()

    text = soup.get_text("\n")

    lines = [
        line.strip()
        for line in text.split("\n")
        if line.strip()
    ]

    return "\n".join(lines)


def extract_candidate_chunks(text: str) -> str:

    lines = text.split("\n")

    email_regex = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+")
    linkedin_regex = re.compile(r"linkedin\.com", re.I)

    name_regex = re.compile(
        r"(Dr\.?\s+[A-Z][a-z]+)|([A-Z][a-z]+\s+[A-Z][a-z]+)"
    )

    selected = set()

    for i, line in enumerate(lines):

        line_lower = line.lower()

        if (
            email_regex.search(line)
            or linkedin_regex.search(line)
            or name_regex.search(line)
            or any(k in line_lower for k in TITLE_KEYWORDS)
        ):

            start = max(0, i - 25)
            end = min(len(lines), i + 25)

            for j in range(start, end):
                selected.add(j)

    if not selected:
        selected = set(range(min(100, len(lines))))

    return "\n".join(lines[i] for i in sorted(selected))


def extract_json(content: str):

    try:
        return json.loads(content)
    except:
        pass

    start = content.find("[")
    end = content.rfind("]")

    if start == -1 or end == -1:
        return []

    try:
        return json.loads(content[start:end + 1])
    except:
        return []


def call_ollama(text_chunk: str, company_name: str):

    if len(text_chunk.strip()) < 20:
        return []

    prompt = f"""
Extract ONLY real humans working at {company_name}.

Return STRICT JSON.

Format:

[
 {{
   "full_name":"",
   "title":"",
   "email":"",
   "phone":"",
   "linkedin_url":""
 }}
]

Rules:

- Do not return company names.
- Do not return clinics.
- Do not return hospitals.
- Do not return agencies.
- Do not return support emails.
- Only return real people.
- Return JSON only.
"""

    try:

        response = ollama.chat(
            model="qwen3:8b",
            messages=[
                {
                    "role": "system",
                    "content": "You are a JSON extraction engine."
                },
                {
                    "role": "user",
                    "content": prompt + "\n\n" + text_chunk[:15000]
                }
            ],
            options={
                "temperature": 0
            }
        )

        content = response["message"]["content"]

        contacts = extract_json(content)

        if isinstance(contacts, list):
            return contacts

    except Exception as e:
        logger.error(f"Ollama Error: {e}")

    return []


def determine_source(url: str):

    url = url.lower()

    if "/team" in url or "/our-team" in url or "/staff" in url:
        return "website_team_page"

    if (
        "/leadership" in url
        or "/management" in url
        or "/founders" in url
    ):
        return "website_leadership_page"

    if "/about" in url:
        return "website_about_page"

    return "website_homepage"


def confidence(source: str):

    if source == "website_team_page":
        return 100

    if source == "website_leadership_page":
        return 100

    if source == "website_about_page":
        return 90

    return 70


def main():

    start = time.time()

    parser = argparse.ArgumentParser()

    parser.add_argument("--company", required=True)
    parser.add_argument("--website", required=True)

    args = parser.parse_args()

    website = args.website

    if not website.startswith("http"):
        website = f"https://{website}"

    targets = [
        website,
        urllib.parse.urljoin(website, "/about"),
        urllib.parse.urljoin(website, "/team"),
        urllib.parse.urljoin(website, "/leadership"),
        urllib.parse.urljoin(website, "/founders")
    ]

    urls = []
    seen_urls = set()

    for u in targets:
        if u not in seen_urls:
            seen_urls.add(u)
            urls.append(u)

    urls = urls[:3]

    metrics = {
        "pages_crawled": 0,
        "characters_processed": 0,
        "ai_calls": 0
    }

    contacts = []
    seen_contacts = set()

    for url in urls:

        if time.time() - start > 50:
            break

        try:

            r = requests.get(
                url,
                headers=HEADERS,
                timeout=10
            )

            if r.status_code != 200:
                continue

            metrics["pages_crawled"] += 1

            text = clean_html(r.text)

            text = text[:10000]

            metrics["characters_processed"] += len(text)

            chunk = extract_candidate_chunks(text)

            metrics["ai_calls"] += 1

            extracted = call_ollama(
                chunk,
                args.company
            )

            source = determine_source(url)

            for c in extracted:

                full_name = c.get("full_name", "").strip()

                key = (
                    full_name.lower(),
                    c.get("email", "").lower()
                )

                if not full_name:
                    continue

                if key in seen_contacts:
                    continue

                seen_contacts.add(key)

                c["source"] = source
                c["confidence_score"] = confidence(source)

                contacts.append(c)

        except Exception as e:
            logger.error(f"{url}: {e}")

    output = {
        "contacts": contacts,
        "metrics": metrics,
        "processing_time": round(
            time.time() - start,
            2
        )
    }

    print(json.dumps(output))


if __name__ == "__main__":
    main()
