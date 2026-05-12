const TARGET_BASE = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");

export default async function handler(request) {
  // Check if TARGET_DOMAIN is configured
  if (!TARGET_BASE) {
    return new Response(JSON.stringify({ error: "TARGET_DOMAIN not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Get the full path from the request
    const url = new URL(request.url);
    const path = url.pathname + url.search;
    
    // Build the target URL
    let targetUrl = TARGET_BASE;
    if (path !== "/" && path !== "") {
      targetUrl = TARGET_BASE + path;
    }
    
    // Create new headers - only essential ones
    const headers = new Headers();
    headers.set("User-Agent", "Netlify-Edge-Function/1.0");
    headers.set("Accept", "*/*");
    
    // Forward content-type if present
    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }
    
    // Prepare fetch options
    const fetchOptions = {
      method: request.method,
      headers: headers,
      redirect: "follow"
    };
    
    // Add body for non-GET requests
    if (request.method !== "GET" && request.method !== "HEAD") {
      try {
        fetchOptions.body = await request.text();
      } catch (e) {
        // No body or error reading body
      }
    }
    
    // Make the request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(targetUrl, {
      ...fetchOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Return the response
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "no-store"
      }
    });
    
  } catch (error) {
    // Return a clean 502 error
    return new Response(JSON.stringify({ 
      error: "Service Unavailable",
      message: error.message || "Relay failed"
    }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
}
