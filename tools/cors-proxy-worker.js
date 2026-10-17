// A tiny CORS proxy for the AI calls, to deploy once as a Cloudflare Worker (free plan is enough).
// The My PC iframe is a browser page, and the AI providers do not allow browser calls (CORS).
// Usage: set app_config "corsProxy": { "enabled": true, "url": "https://<your-worker>.workers.dev/" }.
// The app then calls  <url>https://api.provider.com/...  and this worker forwards it, adding the CORS headers.
// Only the hosts below are forwarded; the API key travels in the request exactly as the app sends it and is never stored.
const ALLOWED = [
  /^https:\/\/integrate\.api\.nvidia\.com\//,
  /^https:\/\/ai\.api\.nvidia\.com\//,
  /^https:\/\/[a-z0-9-]+\.invocation\.api\.nvcf\.nvidia\.com\//,
  /^https:\/\/api\.openai\.com\//,
  /^https:\/\/generativelanguage\.googleapis\.com\//,
];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-goog-api-key, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    // "/https://host/path?x" may arrive as "/https:/host/path": put the second slash back.
    const target = (url.pathname.slice(1) + url.search).replace(/^(https?):\/+/, '$1://');
    if (!ALLOWED.some((re) => re.test(target))) return new Response('host not allowed', { status: 403, headers: CORS });
    const headers = new Headers();
    for (const h of ['authorization', 'content-type', 'x-goog-api-key', 'accept']) if (request.headers.get(h)) headers.set(h, request.headers.get(h));
    const upstream = await fetch(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body });
    const out = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(CORS)) out.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
