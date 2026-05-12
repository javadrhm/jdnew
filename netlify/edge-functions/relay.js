const TARGET_BASE = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");

export default async function handler(request, context) {
  // Check if TARGET_DOMAIN is configured
  if (!TARGET_BASE) {
    return new Response("Misconfigured: TARGET_DOMAIN is not set", { status: 500 });
  }

  try {
    // Construct the target URL from the original request
    const url = new URL(request.url);
    const targetUrl = TARGET_BASE + url.pathname + url.search;
    
    // CRITICAL: Use rewrite instead of fetch
    // This tells Netlify to serve content from your backend URL
    // as if it were a static file - completely bypassing fetch restrictions
    return context.rewrite(targetUrl);
    
  } catch (error) {
    return new Response("Service Unavailable", { 
      status: 502,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store"
      }
    });
  }
}
