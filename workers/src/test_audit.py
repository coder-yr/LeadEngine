import os
import logging
from audit import audit_website

logging.basicConfig(level=logging.INFO)

def main():
    print("-------------------------------------------------")
    print("Testing Website Audit Agent")
    
    # We test on digitalrisemarketing.in as an example
    test_url = "https://digitalrisemarketing.in"
    
    try:
        result = audit_website(test_url)
        print("\n--- AUDIT SUCCESSFUL ---")
        print(result.model_dump_json(indent=2))
        print("-------------------------------------------------")
    except Exception as e:
        print(f"\n--- AUDIT FAILED ---")
        print(str(e))

if __name__ == "__main__":
    main()
