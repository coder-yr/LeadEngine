import { supabase } from '../config/supabase.js';

export class OutreachCommunicationService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  }

  /**
   * Constructs an email with an embedded tracking pixel.
   */
  async sendEmail(
    messageId: string,
    contactId: string,
    toAddress: string,
    subject: string,
    body: string
  ): Promise<boolean> {
    try {
      // 1. Build the invisible tracking pixel
      const trackingPixelUrl = `${this.apiBaseUrl}/api/tracking/open/${messageId}`;
      const trackingPixelHtml = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" />`;

      // 2. Wrap body in simple HTML if it isn't already, and inject the pixel at the end.
      const finalHtmlBody = `
        <div style="font-family: sans-serif;">
          ${body.replace(/\n/g, '<br/>')}
          ${trackingPixelHtml}
        </div>
      `;

      // TODO: Actually send the email via SendGrid, AWS SES, or Resend API here.
      console.log(`[Outreach] Simulating EMAIL sent to ${toAddress}`);
      console.log(`[Outreach] Subject: ${subject}`);
      // console.log(`[Outreach] Body: ${finalHtmlBody}`);

      return true;
    } catch (error) {
      console.error(`[Outreach] Failed to send email to ${toAddress}:`, error);
      return false;
    }
  }

  /**
   * Constructs and sends a WhatsApp message.
   */
  async sendWhatsApp(
    messageId: string,
    contactId: string,
    phoneNumber: string,
    body: string
  ): Promise<boolean> {
    try {
      // TODO: Actually send the message via Meta/Twilio API here.
      // WhatsApp does not support tracking pixels, so we rely on webhook callbacks from the provider
      // to call our /api/tracking/reply or delivery status webhooks.
      console.log(`[Outreach] Simulating WHATSAPP sent to ${phoneNumber}`);
      console.log(`[Outreach] Body: ${body}`);

      return true;
    } catch (error) {
      console.error(`[Outreach] Failed to send whatsapp to ${phoneNumber}:`, error);
      return false;
    }
  }
}
