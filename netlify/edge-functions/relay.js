const TARGET_BASE = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");

// Rotating User-Agents to avoid detection
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
];

// Get random user agent based on path hash (consistent per session)
function getUserAgent(pathname) {
  const hash = pathname.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return USER_AGENTS[hash % USER_AGENTS.length];
}

export default async function handler(request, context) {
  // Check configuration
  if (!TARGET_BASE) {
    return new Response(JSON.stringify({ error: "TARGET_DOMAIN not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const url = new URL(request.url);
  const targetUrl = TARGET_BASE + url.pathname + url.search;
  const method = request.method;
  
  try {
    // Strategy 1: Try rewrite first (fastest, least likely to be blocked)
    if (method === "GET" && !url.searchParams.has("_t")) {
      try {
        return await context.rewrite(targetUrl);
      } catch (rewriteError) {
        // Fall through to fetch method if rewrite fails
        console.log("Rewrite failed, falling back to fetch");
      }
    }
    
    // Strategy 2: Fetch with browser-like headers
    const headers = new Headers();
    
    // Essential browser headers
    headers.set("User-Agent", getUserAgent(url.pathname));
    headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
    headers.set("Accept-Language", "en-US,en;q=0.9");
    headers.set("Accept-Encoding", "gzip, deflate, br");
    headers.set("Sec-Ch-Ua", '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"');
    headers.set("Sec-Ch-Ua-Mobile", "?0");
    headers.set("Sec-Ch-Ua-Platform", '"Windows"');
    headers.set("Sec-Fetch-Dest", "document");
    headers.set("Sec-Fetch-Mode", "navigate");
    headers.set("Sec-Fetch-Site", "none");
    headers.set("Sec-Fetch-User", "?1");
    headers.set("Upgrade-Insecure-Requests", "1");
    
    // Forward necessary headers from original request
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    
    const contentLength = request.headers.get("content-length");
    if (contentLength && method !== "GET") headers.set("content-length", contentLength);
    
    // Forward specific V2Ray headers that might be needed (renamed to avoid detection)
    const xHttpMode = request.headers.get("x-http-mode");
    if (xHttpMode) headers.set("X-Request-Mode", xHttpMode);
    
    // Prepare fetch options
    const fetchOptions = {
      method,
      headers,
      redirect: "follow",
      cf: {
        cacheTtl: 0,
        cacheEverything: false
      }
    };
    
    // Add body for non-GET requests
    if (method !== "GET" && method !== "HEAD") {
      fetchOptions.body = request.body;
    }
    
    // Make the request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const upstream = await fetch(targetUrl, { ...fetchOptions, signal: controller.signal });
    clearTimeout(timeoutId);
    
    // Process response
    const responseHeaders = new Headers();
    
    // Forward important response headers
    const forwardHeaders = ["content-type", "content-length", "cache-control", "date", "server", "location"];
    for (const header of forwardHeaders) {
      const value = upstream.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }
    
    // Add anti-caching headers
    responseHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    responseHeaders.set("Pragma", "no-cache");
    responseHeaders.set("Expires", "0");
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    
    // Return response
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
    
  } catch (error) {
    // Strategy 3: Fallback to simple passthrough if all else fails
    console.error("Relay error:", error.message);
    
    try {
      // Last resort - minimal fetch
      const simpleResponse = await fetch(targetUrl, {
        method,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NetlifyRelay/1.0)"
        }
      });
      
      return new Response(simpleResponse.body, {
        status: simpleResponse.status,
        headers: {
          "content-type": simpleResponse.headers.get("content-type") || "application/octet-stream"
        }
      });
    } catch (finalError) {
      return new Response(JSON.stringify({ 
        error: "Service Unavailable",
        message: "Unable to reach target server"
      }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
}
