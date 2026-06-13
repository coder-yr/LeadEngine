import os
import logging
from intelligence import analyze_business

logging.basicConfig(level=logging.INFO)

def main():
    print("-------------------------------------------------")
    print("Testing Lead Intelligence Engine")
    
    # We can pass OpenAI API key if needed, or rely on Ollama
    # os.environ["OPENAI_API_KEY"] = "sk-..."

    # Sample business data
    sample_data = {
        "business_name": "DigitalRise Marketing",
        "phone": "+91 70216 02399",
        "email": None,
        "address": "Hendrepada, Badlapur West, Maharashtra, India - 421503",
        "website": "digitalrisemarketing.com",
        "social_links": [
            "https://www.instagram.com/digitalrisemarketing/"
        ],
        # Example extracted text or insights from the website content could be added here
        "notes": "No WhatsApp button found on the homepage. No CRM forms or booking system detected."
    }
    
    try:
        result = analyze_business(sample_data)
        print("\n--- ANALYSIS SUCCESSFUL ---")
        print(result.model_dump_json(indent=2))
        print("-------------------------------------------------")
    except Exception as e:
        print(f"\n--- ANALYSIS FAILED ---")
        print(str(e))

if __name__ == "__main__":
    main()
