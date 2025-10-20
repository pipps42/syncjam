import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Consolidated Spotify API Proxy
 *
 * Actions:
 * - search: Search tracks (includes automatic token management)
 */

// Token cache (in-memory, shared across invocations within same instance)
interface CachedToken {
  access_token: string;
  expires_at: number; // Unix timestamp in milliseconds
}

let tokenCache: CachedToken | null = null;

/**
 * Get Spotify access token using Client Credentials flow
 * Uses in-memory cache to minimize API calls
 */
async function getSpotifyAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (tokenCache && tokenCache.expires_at > Date.now()) {
    console.log('[SPOTIFY] Using cached token');
    return tokenCache.access_token;
  }

  console.log('[SPOTIFY] Fetching new access token');

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials'
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[SPOTIFY] Token fetch failed:', errorData);
    throw new Error(`Failed to get Spotify access token: ${errorData.error_description || errorData.error}`);
  }

  const data = await response.json();

  // Cache token with 5-minute buffer before expiration
  const expiresIn = (data.expires_in - 300) * 1000; // Convert to ms, subtract 5 minutes
  tokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + expiresIn
  };

  console.log('[SPOTIFY] Token cached, expires in', Math.round(expiresIn / 1000 / 60), 'minutes');

  return data.access_token;
}

/**
 * Rate limiting: Simple in-memory tracker (per IP)
 */
interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 30; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in ms

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt < now) {
    // Create new entry
    rateLimitMap.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW
    });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: RATE_LIMIT_WINDOW };
  }

  if (entry.count >= RATE_LIMIT) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetAt - now
    };
  }

  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT - entry.count,
    resetIn: entry.resetAt - now
  };
}

/**
 * ACTION: search
 * Search Spotify tracks
 */
async function handleSearch(req: VercelRequest, res: VercelResponse) {
  const { q, limit = '20', offset = '0' } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({
      error: 'Missing query',
      details: 'q query parameter is required'
    });
  }

  if (q.trim().length === 0) {
    return res.status(400).json({
      error: 'Empty query',
      details: 'q must not be empty'
    });
  }

  // Rate limiting
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                   (req.headers['x-real-ip'] as string) ||
                   'unknown';

  const rateLimit = checkRateLimit(clientIp);

  // Always set rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetIn / 1000).toString());

  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      details: `Maximum ${RATE_LIMIT} requests per minute. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`,
      retry_after: Math.ceil(rateLimit.resetIn / 1000)
    });
  }

  try {
    // Get access token (cached or new)
    const accessToken = await getSpotifyAccessToken();

    // Search Spotify
    const searchParams = new URLSearchParams({
      q: q.trim(),
      type: 'track',
      limit: limit.toString(),
      offset: offset.toString(),
      market: 'US'
    });

    const searchUrl = `https://api.spotify.com/v1/search?${searchParams}`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      console.error('[SPOTIFY] Search failed:', errorData);
      return res.status(searchResponse.status).json({
        error: 'Spotify search failed',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const searchData = await searchResponse.json();

    // Simplify track data
    const tracks = searchData.tracks.items.map((track: any) => ({
      id: track.id,
      uri: track.uri,
      name: track.name,
      artists: track.artists.map((a: any) => a.name),
      artistNames: track.artists.map((a: any) => a.name).join(', '),
      album: track.album.name,
      albumImage: track.album.images[0]?.url || null,
      duration_ms: track.duration_ms,
      explicit: track.explicit,
      preview_url: track.preview_url
    }));

    return res.status(200).json({
      tracks,
      total: searchData.tracks.total,
      limit: searchData.tracks.limit,
      offset: searchData.tracks.offset,
      next: searchData.tracks.next,
      previous: searchData.tracks.previous
    });
  } catch (error) {
    console.error('[SPOTIFY] Search error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Main handler with action routing
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'search':
        return handleSearch(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid action',
          details: `Action must be one of: search. Got: ${action}`
        });
    }
  } catch (error) {
    console.error('[SPOTIFY] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
