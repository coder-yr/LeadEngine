import sys
from website_contact_scraper import extract_website_contacts
import json

def test_scrape():
    url = sys.argv[1] if len(sys.argv) > 1 else "https://techflowsolutions.com/about"
    print(f"Testing ScrapeGraphAI Contact Extraction on: {url}")
    print("This may take a few moments depending on the website size and Ollama speed...\n")
    
    contacts = extract_website_contacts(url)
    print("\n--- RESULTS ---")
    print(json.dumps(contacts, indent=2))
    print("----------------")

if __name__ == "__main__":
    test_scrape()
