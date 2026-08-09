import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase.js';

// Augment Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

/**
 * requireAuth — extracts and verifies the Supabase JWT from the Authorization header.
 * On success, attaches req.user = { id, email }.
 * On failure, returns 401.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const token = authHeader.substring(7); // strip "Bearer "

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }

    // Attach verified user to request — never trust frontend-provided identity
    req.user = {
      id: data.user.id,
      email: data.user.email || '',
    };

    next();
  } catch (err) {
    console.error('[Auth Middleware] Unexpected error:', err);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
}

/**
 * optionalAuth — like requireAuth but doesn't block if no token is present.
 * Useful for routes that work for both authenticated and anonymous users.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  try {
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) {
      req.user = { id: data.user.id, email: data.user.email || '' };
    }
  } catch {
    // Ignore errors — user just won't be attached
  }
  next();
}
