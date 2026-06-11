/**
 * Fallback OG image (#29) for the home, library/playlist, and journey-album
 * routes — `/og/default.png`, pre-rendered at build (static output).
 */
import type { APIRoute } from 'astro';
import { renderOgImage } from '../../lib/og';

export const GET: APIRoute = async () => {
  const png = await renderOgImage({
    title: 'Portfolio',
    sym: 'dm',
    hue: '#8b7cf6',
    kind: 'Agents · Trading infra · iOS',
    tagline: 'Building agentic systems and trading infrastructure in NYC.',
  });
  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
