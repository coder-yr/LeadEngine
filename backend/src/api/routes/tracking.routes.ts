import { Router, Request, Response } from 'express';
import { CampaignRepository } from '../../db/repositories/CampaignRepository.js';

const router = Router();
const campaignRepo = new CampaignRepository();

// Generates a minimal 1x1 transparent GIF buffer
const pixelBuffer = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * GET /api/tracking/open/:messageId
 * Triggered by the invisible 1x1 image pixel embedded inside outreach emails.
 * Returns the transparent image so the user's email client doesn't break.
 */
router.get('/open/:messageId', async (req: Request, res: Response) => {
  const { messageId } = req.params;

  try {
    // Fire-and-forget the tracking process so the image returns instantly
    campaignRepo.trackMessageOpen(messageId).catch(err => {
      console.error(`[Tracking API] Failed to track open for message ${messageId}:`, err);
    });
  } catch (error) {
    // Ignore errors to guarantee the pixel always loads
  }

  // Send the transparent pixel
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixelBuffer.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private'
  });
  res.end(pixelBuffer);
});

/**
 * POST /api/tracking/reply
 * Webhook endpoint intended for SendGrid/Twilio/Meta to POST reply events to.
 * Expects a JSON payload containing the original messageId.
 */
router.post('/reply', async (req: Request, res: Response) => {
  try {
    const { messageId, replyBody } = req.body;

    if (!messageId) {
      return res.status(400).json({ success: false, error: 'messageId is required' });
    }

    const message = await campaignRepo.trackMessageReply(messageId, replyBody);

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({ success: true, message: 'Reply tracked successfully' });
  } catch (error: any) {
    console.error(`[Tracking API] Failed to track reply:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
