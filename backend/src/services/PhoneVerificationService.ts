import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export interface PhoneVerificationResult {
  isValidFormat: boolean;
  e164Format: string | null;
  countryCode: string | null;
  isWhatsAppActive: boolean;
}

export class PhoneVerificationService {
  /**
   * Strictly parses the raw phone string to extract countryCode and normalize to E.164.
   */
  public parseAndValidate(phone: string, defaultCountry: CountryCode = 'US'): { isValidFormat: boolean; e164Format: string | null; countryCode: string | null } {
    try {
      // Allow passing dirty numbers, libphonenumber will extract digits
      const phoneNumber = parsePhoneNumberFromString(phone, defaultCountry);

      if (phoneNumber && phoneNumber.isValid()) {
        return {
          isValidFormat: true,
          e164Format: phoneNumber.number, // Native E.164 string format (+1...)
          countryCode: phoneNumber.country || null,
        };
      }
    } catch (e) {
      console.warn(`Error parsing phone number ${phone}:`, e);
    }

    return {
      isValidFormat: false,
      e164Format: null,
      countryCode: null,
    };
  }

  /**
   * Re-implements logic natively in Node.js to check wa.me endpoints via HTTP HEAD request.
   * Returns true if wa.me indicates successful routing for this number.
   */
  public async checkWhatsApp(e164Phone: string): Promise<boolean> {
    try {
      const digitsOnly = e164Phone.substring(1); // Remove the '+' for wa.me URL
      const waUrl = `https://wa.me/${digitsOnly}`;

      const response = await fetch(waUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        // We do not want to automatically follow redirect to deep links
        redirect: 'follow', 
      });

      // Usually wa.me returns 200 for properly formatted numbers routed correctly.
      return response.status === 200;
    } catch (err) {
      console.warn(`Failed to verify WhatsApp for ${e164Phone}:`, err);
      // Fallback to false if the network request strictly fails
      return false;
    }
  }

  /**
   * Orchestrates formatting, parsing, and WhatsApp validation.
   */
  public async verifyPhone(phone: string): Promise<PhoneVerificationResult> {
    const parsed = this.parseAndValidate(phone);

    if (!parsed.isValidFormat || !parsed.e164Format) {
      return {
        isValidFormat: false,
        e164Format: null,
        countryCode: null,
        isWhatsAppActive: false
      };
    }

    const isWhatsAppActive = await this.checkWhatsApp(parsed.e164Format);

    return {
      isValidFormat: true,
      e164Format: parsed.e164Format,
      countryCode: parsed.countryCode,
      isWhatsAppActive
    };
  }
}
