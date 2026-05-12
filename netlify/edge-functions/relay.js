const TARGET_BASE = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");

// Expanded strip headers - remove anything that looks like proxy/V2Ray traffic
const STRIP_HEADERS = new Set([
  "host",
  "connection", 
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-forwarded-for",
  "x-real-ip",
  "x-v2ray",
  "x-vless",
  "x-xtls",
  "x-http",
  "x-protocol",
  "cf-ray",
  "cf-connecting-ip",
  "cf-worker",
  "x-requested-with",
  "sec-websocket-key",
  "sec-websocket-version",
  "sec-websocket-extensions"
]);

export default async function handler(request) {
  if (!TARGET_BASE) {
    return new Response("Misconfigured: TARGET_DOMAIN is not set", { status: 500 });
  }

  try {
    const url = new URL(request.url);
    const targetUrl = TARGET_BASE + url.pathname + url.search;

    // Create completely clean headers - only safe browser-like ones
    const headers = new Headers();
    
    // Add safe, browser-like headers only
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
    headers.set("Accept-Language", "en-US,en;q=0.9");
    headers.set("Accept-Encoding", "gzip, deflate, br");
    headers.set("Connection", "keep-alive");
    headers.set("Sec-Fetch-Dest", "document");
    headers.set("Sec-Fetch-Mode", "navigate");
    headers.set("Sec-Fetch-Site", "none");
    
    // Only forward content-type if present and safe
    const contentType = request.headers.get("content-type");
    if (contentType && contentType.startsWith("application/")) {
      headers.set("content-type", contentType);
    }
    
    // Forward content-length only if body exists
    const method = request.method;
    const hasBody = method !== "GET" && method !== "HEAD";
    
    if (hasBody) {
      const contentLength = request.headers.get("content-length");
      if (contentLength) headers.set("content-length", contentLength);
    }

    const fetchOptions = {
      method,
      headers,
      redirect: "manual",
    };

    if (hasBody) {
      fetchOptions.body = request.body;
    }

    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const upstream = await fetch(targetUrl, fetchOptions);

    // Clean response headers
    const responseHeaders = new Headers();
    const FORBIDDEN_RESPONSE_HEADERS = new Set([
      "transfer-encoding",
      "connection",
      "keep-alive",
      "upgrade"
    ]);
    
    for (const [key, value] of upstream.headers) {
      const k = key.toLowerCase();
      if (FORBIDDEN_RESPONSE_HEADERS.has(k)) continue;
      if (k.startsWith("x-nf-")) continue;
      if (k.startsWith("x-netlify-")) continue;
      responseHeaders.set(key, value);
    }
    
    // Add cache control to prevent detection
    responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
    
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
    
  } catch (error) {
    // Log error for debugging (optional)
    console.error("Relay error:", error.message);
    return new Response("Service Unavailable", { 
      status: 502,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store"
      }
    });
  }
}
