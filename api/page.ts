// Serves the SPA shell for every non-asset, non-API route — but first swaps
// in the *current* cafe name/tagline/logo from the database, so link
// previews (WhatsApp, Telegram, Slack, X, etc.) and the browser tab title
// on first paint reflect whatever the admin has renamed the cafe to,
// instead of the name baked into the static build at deploy time.
//
// The built index.html (with its content-hashed asset paths from Vite) is
// fetched at request time from this same deployment's own static file
// (see the explicit "/index.html" route in vercel.json that keeps it
// reachable directly) rather than read from disk — the api/ and
// static-build steps run in separate, isolated build environments on
// Vercel, so this function's bundle never has access to dist/ at build time.
import type { IncomingMessage, ServerResponse } from 'http';
import { query } from '../server/db.js';

const DEFAULT_TITLE = 'QR Ordering & Kitchen System';
const DEFAULT_DESCRIPTION =
  'A complete QR-based ordering system for cafes featuring customer digital menu, live order tracking, kitchen display system (KDS), table QR code generator, and cafe administration.';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replaceTag(html: string, pattern: RegExp, replacement: string): string {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

async function fetchBuiltShell(req: IncomingMessage): Promise<string> {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${proto}://${host}/index.html`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Static shell fetch failed: ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  let html: string;
  try {
    html = await fetchBuiltShell(req);
  } catch (err) {
    console.error('[page] Could not fetch built index.html shell:', err);
    res.statusCode = 502;
    res.end('Failed to load page shell');
    return;
  }

  try {
    const result = await query('SELECT name, tagline, logo_url FROM cafes LIMIT 1');
    const cafe = result.rows[0];
    const name: string | undefined = cafe?.name?.trim();
    const tagline: string | undefined = cafe?.tagline?.trim();
    const logo: string | undefined = cafe?.logo_url?.trim();

    const title = escapeHtml(name ? `${name} - QR Ordering & Kitchen System` : DEFAULT_TITLE);
    const description = escapeHtml(tagline || DEFAULT_DESCRIPTION);

    html = replaceTag(html, /<title>.*?<\/title>/s, `<title>${title}</title>`);
    html = replaceTag(
      html,
      /<meta name="description" content=".*?"\s*\/>/s,
      `<meta name="description" content="${description}" />`
    );
    html = replaceTag(
      html,
      /<meta property="og:title" content=".*?"\s*\/>/s,
      `<meta property="og:title" content="${title}" />`
    );
    html = replaceTag(
      html,
      /<meta property="og:description" content=".*?"\s*\/>/s,
      `<meta property="og:description" content="${description}" />`
    );

    if (logo) {
      const ogImageTag = `<meta property="og:image" content="${escapeHtml(logo)}" />`;
      if (/<meta property="og:image" content=".*?"\s*\/>/s.test(html)) {
        html = html.replace(/<meta property="og:image" content=".*?"\s*\/>/s, ogImageTag);
      } else {
        html = html.replace(
          '<meta property="og:type" content="website" />',
          `<meta property="og:type" content="website" />\n    ${ogImageTag}`
        );
      }
    }
  } catch (err) {
    // DB unreachable or table empty — fall back to the static build's own
    // meta tags rather than failing the whole page load.
    console.error('[page] Could not load dynamic cafe meta:', err);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short edge cache so a rename shows up within a minute without hammering
  // the database on every single page view.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  res.statusCode = 200;
  res.end(html);
}
