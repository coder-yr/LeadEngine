import logging
from whatsapp_verifier import verify_whatsapp, normalize_e164

# Setup basic logging to see output clearly
logging.basicConfig(level=logging.INFO)

def run_tests():
    print("-------------------------------------------------")
    print("Testing WhatsApp Verification Service")
    print("-------------------------------------------------")

    # A mix of valid and invalidly formatted numbers
    test_cases = [
        "+1 415-555-2671",        # US number with spaces and dashes
        "447700900000",           # UK number missing the plus sign
        "91 98765 43210",         # India number missing plus sign, with spaces
        "invalid_text",           # Completely invalid
        "+123",                   # Too short for E.164
    ]

    for phone in test_cases:
        print(f"\nTesting Input: '{phone}'")
        try:
            e164_normalized = normalize_e164(phone)
            print(f" Normalized : {e164_normalized}")
        except ValueError as e:
            print(f" Normalized : FAILED ({e})")
            
        result = verify_whatsapp(phone)
        print(f" Result     : {result.value}")

    print("\n-------------------------------------------------")

if __name__ == "__main__":
    run_tests()
