import os
import logging
from extractor import extract_business_info

# Basic logging setup to see output
logging.basicConfig(level=logging.INFO)

# Define a test URL (e.g., a sample digital agency or business site)
TEST_URL = "https://www.apolloclinic.com"

def main():
    print("-------------------------------------------------")
    print(f"Testing ScrapeGraphAI Extraction on: {TEST_URL}")
    
    # If using OpenAI instead of local Ollama, uncomment and add your key:
    # os.environ["OPENAI_API_KEY"] = "sk-..."

    try:
        result = extract_business_info(TEST_URL)
        print("\n--- EXTRACTION SUCCESSFUL ---")
        # Pydantic models can be printed as JSON dictionaries easily
        print(result.model_dump_json(indent=2))
        print("-------------------------------------------------")
    except Exception as e:
        print(f"\n--- EXTRACTION FAILED ---")
        print(str(e))

if __name__ == "__main__":
    main()
