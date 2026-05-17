// Custom Edge Relay Handler
const TARGET_BASE = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");

const BLOCKED_HEADERS = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailer", "transfer-encoding",
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port"
]);

export default async (req, context) => {
  // Check configuration
  if (!TARGET_BASE) {
    return new Response("Misconfigured: TARGET_DOMAIN is not set", { status: 500 });
  }

  try {
    const parsedUrl = new URL(req.url);
    const targetUrl = TARGET_BASE + parsedUrl.pathname + parsedUrl.search;
    
    const proxyHeaders = new Headers();
    let clientAddress = null;

    // Process headers - same as working code pattern
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      
      // Skip blocked and Netlify internal headers
      if (BLOCKED_HEADERS.has(lowerKey) || 
          lowerKey.startsWith("x-nf-") || 
          lowerKey.startsWith("x-netlify-")) {
        return;
      }
      
      // Track client IP
      if (lowerKey === "x-real-ip") {
        clientAddress = value;
        return;
      }
      if (lowerKey === "x-forwarded-for") {
        if (!clientAddress) clientAddress = value;
        return;
      }
      
      proxyHeaders.set(lowerKey, value);
    });

    // Set forwarded IP if we captured it
    if (clientAddress) {
      proxyHeaders.set("x-forwarded-for", clientAddress);
    }

    const reqMethod = req.method;
    const fetchConfig = {
      method: reqMethod,
      headers: proxyHeaders,
      redirect: "manual",
      body: (reqMethod === "GET" || reqMethod === "HEAD") ? undefined : req.body,
    };

    const upstream = await fetch(targetUrl, fetchConfig);
    
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "transfer-encoding") {
        responseHeaders.set(key, value);
      }
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response("Bad Gateway: Relay Failed", { status: 502 });
  }
};
