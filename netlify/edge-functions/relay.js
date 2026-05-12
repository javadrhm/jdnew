const TARGET_BASE = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");

export default async function handler(request, context) {
  if (!TARGET_BASE) {
    return new Response("TARGET_DOMAIN not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const targetUrl = TARGET_BASE + url.pathname + url.search;

  // Use rewrite - NO fetch() call
  // This tells Netlify CDN to serve from your backend as if it were static content
  return context.rewrite(new URL(targetUrl));
}
